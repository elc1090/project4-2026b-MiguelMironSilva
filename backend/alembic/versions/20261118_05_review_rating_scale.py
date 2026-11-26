"""Exige notas de avaliação de 1 a 10 e converte os zeros antigos em um.

Revision ID: 20261118_05
Revises: 20261118_04

A reversão volta a aceitar 0, mas mantém as notas armazenadas: um
1 convertido não pode ser distinguido de um 1 anterior ou adicionado depois.
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
    # Como na revisão 04, use a conexão de migração sem verificação de chaves estrangeiras,
    # para que DROP TABLE não propague exclusões; confira as referências antes de confirmar.
    if connection.dialect.name != "sqlite" or connection.exec_driver_sql("PRAGMA foreign_keys").scalar():
        raise RuntimeError("A migração de notas exige SQLite sem foreign_keys na conexão de migração")
    if not connection.connection.driver_connection.in_transaction:
        # O modo legado de transações do sqlite3 não inicia uma transação para DDL.
        connection.exec_driver_sql("BEGIN IMMEDIATE")

    ddl = connection.exec_driver_sql(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reviews'"
    ).scalar_one()
    # Reutilize a definição existente; a reflexão pode ignorar restrições do SQLite,
    # como UNIQUE embutido, e não reproduz todos os índices e gatilhos personalizados.
    ddl, tables = _TABLE.subn(f'CREATE TABLE "{_TEMP}"', ddl)
    checks = list(_RANGE.finditer(ddl))
    if tables != 1 or len(checks) != 1 or checks[0].group(2) != str(source_min):
        raise RuntimeError("Definição SQLite inesperada para o CHECK de notas de reviews")
    ddl = _RANGE.sub(lambda match: f"{match.group(1)}{target_min}", ddl)
    # A reconstrução em lote da revisão 03 removeu AUTOINCREMENT no fluxo normal de migrações.
    # Restaure-o nesses bancos e mantenha-o nos bancos que já o possuem.
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
        if hidden == 0  # O SQLite recalcula colunas geradas; elas não são inseridas.
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
    # Visões e gatilhos dependentes em outras tabelas mantêm referências a "reviews".
    # Enquanto esse nome não existe, versões recentes de ALTER TABLE rejeitam essas referências.
    legacy_rename = connection.exec_driver_sql("PRAGMA legacy_alter_table").scalar_one()
    connection.exec_driver_sql("PRAGMA legacy_alter_table = ON")
    try:
        connection.exec_driver_sql(f'ALTER TABLE "{_TEMP}" RENAME TO "reviews"')
    finally:
        connection.exec_driver_sql(f"PRAGMA legacy_alter_table = {int(legacy_rename)}")

    if prior_sequence is not None:
        # Copiar linhas define a nova sequência como MAX(id), que pode ser menor
        # que o maior ID já emitido, mesmo se a tabela estiver vazia.
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
