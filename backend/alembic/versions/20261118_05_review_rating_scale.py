"""Require review ratings from 1 to 10 and convert legacy zeroes to one.

Revision ID: 20261118_05
Revises: 20261118_04

Downgrade accepts 0 again but leaves all stored ratings unchanged: a converted
1 cannot be distinguished from a 1 that was already present or added later.
"""
import re

from alembic import op

revision = "20261118_05"
down_revision = "20261118_04"
branch_labels = None
depends_on = None

_TEMP = "_reviews_20261118_05"
_TABLE = re.compile(r'^CREATE\s+TABLE\s+(?:"reviews"|reviews)(?=\s*\()', re.IGNORECASE)
_RANGE = re.compile(
    r'(\bCONSTRAINT\s+"?ck_reviews_rating_range"?\s+CHECK\s*\(\s*'
    r'rating\s+IS\s+NULL\s+OR\s*\(\s*rating\s*>=\s*)([01])'
    r'(?=\s+AND\s+rating\s*<=\s*10\s*\)\s*\))',
    re.IGNORECASE,
)
_PRIMARY_KEY = re.compile(r'\bPRIMARY\s+KEY\s*\(\s*id\s*\)', re.IGNORECASE)


def _rebuild(source_min, target_min):
    connection = op.get_bind()
    # As in revision 04, use the migration connection without FK enforcement so
    # DROP TABLE cannot cascade; verify all references before committing instead.
    if connection.dialect.name != "sqlite" or connection.exec_driver_sql("PRAGMA foreign_keys").scalar():
        raise RuntimeError("A migração de notas exige SQLite sem foreign_keys na conexão de migração")
    if not connection.connection.driver_connection.in_transaction:
        # sqlite3's legacy transaction mode does not start a transaction for DDL.
        connection.exec_driver_sql("BEGIN IMMEDIATE")

    ddl = connection.exec_driver_sql(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reviews'"
    ).scalar_one()
    # Reuse the existing definition; reflection can miss SQLite constraints such
    # as inline UNIQUE and cannot reproduce all custom indexes/triggers.
    ddl, tables = _TABLE.subn(f'CREATE TABLE "{_TEMP}"', ddl)
    checks = list(_RANGE.finditer(ddl))
    if tables != 1 or len(checks) != 1 or checks[0].group(2) != str(source_min):
        raise RuntimeError("Definição SQLite inesperada para o CHECK de notas de reviews")
    ddl = _RANGE.sub(lambda match: f"{match.group(1)}{target_min}", ddl)
    # The 03 batch rebuild lost AUTOINCREMENT on the normal migration chain.
    # Restore it on those databases; keep it on databases that already have it.
    ddl, keys = _PRIMARY_KEY.subn("PRIMARY KEY (id AUTOINCREMENT)", ddl)
    if keys > 1 or (keys == 0 and not re.search(r"\bAUTOINCREMENT\b", ddl, re.IGNORECASE)):
        raise RuntimeError("Chave primária SQLite inesperada para reviews")

    objects = connection.exec_driver_sql("""
        SELECT sql FROM sqlite_master
        WHERE tbl_name = 'reviews' AND type IN ('index', 'trigger') AND sql IS NOT NULL
        ORDER BY type, name
    """).scalars().all()
    prior_sequence = connection.exec_driver_sql(
        "SELECT MAX(seq) FROM sqlite_sequence WHERE name = 'reviews'"
    ).scalar_one()
    columns = [
        name for _, name, _, _, _, _, hidden in connection.exec_driver_sql("PRAGMA table_xinfo('reviews')")
        if hidden == 0  # Generated columns are recomputed by SQLite, not inserted.
    ]
    quoted_columns = {name: '"' + name.replace('"', '""') + '"' for name in columns}
    select = dict(quoted_columns)
    if target_min == 1:
        select["rating"] = 'CASE WHEN "rating" = 0 THEN 1 ELSE "rating" END'
    connection.exec_driver_sql(ddl)
    connection.exec_driver_sql(
        f'INSERT INTO "{_TEMP}" ({", ".join(quoted_columns.values())}) '
        f'SELECT {", ".join(select.values())} FROM "reviews"'
    )
    connection.exec_driver_sql('DROP TABLE "reviews"')
    # Dependent views/triggers on other tables keep their references to "reviews".
    # While that name is absent, modern ALTER TABLE would reject those references.
    legacy_rename = connection.exec_driver_sql("PRAGMA legacy_alter_table").scalar_one()
    connection.exec_driver_sql("PRAGMA legacy_alter_table = ON")
    try:
        connection.exec_driver_sql(f'ALTER TABLE "{_TEMP}" RENAME TO "reviews"')
    finally:
        connection.exec_driver_sql(f"PRAGMA legacy_alter_table = {int(legacy_rename)}")

    if prior_sequence is not None:
        # Copying rows sets the new sequence to MAX(id), which may be smaller
        # than the greatest previously issued ID, even if the table is empty.
        rebuilt_sequence = connection.exec_driver_sql(
            "SELECT MAX(seq) FROM sqlite_sequence WHERE name = 'reviews'"
        ).scalar_one()
        connection.exec_driver_sql("DELETE FROM sqlite_sequence WHERE name = 'reviews'")
        connection.exec_driver_sql(
            "INSERT INTO sqlite_sequence (name, seq) VALUES ('reviews', ?)",
            (max(prior_sequence, rebuilt_sequence or 0),),
        )
    for ddl in objects:
        connection.exec_driver_sql(ddl)
    if connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
        raise RuntimeError("Chaves estrangeiras inválidas após migração de notas de reviews")


def upgrade():
    _rebuild(source_min=0, target_min=1)


def downgrade():
    _rebuild(source_min=1, target_min=0)
