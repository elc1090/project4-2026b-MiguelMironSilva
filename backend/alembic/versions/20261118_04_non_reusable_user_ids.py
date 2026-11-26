"""Impede a reutilização de IDs de usuário do SQLite (também usados como assuntos JWT).

Revision ID: 20261118_04
Revises: 20261117_03
"""
from alembic import op
import sqlalchemy as sa

revision = "20261118_04"
down_revision = "20261117_03"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    # A conexão SQLite do Alembic, ao contrário da aplicação, não verifica chaves estrangeiras.
    # Reconstruir a tabela pai com essa verificação ativa poderia propagar exclusões.
    if connection.dialect.name != "sqlite" or connection.exec_driver_sql("PRAGMA foreign_keys").scalar():
        raise RuntimeError("A migração de IDs de usuários exige SQLite sem foreign_keys na conexão de migração")
    # O modo legado de transações do SQLite não inicia uma transação para DDL.
    if not connection.connection.driver_connection.in_transaction:
        connection.exec_driver_sql("BEGIN IMMEDIATE")

    # Especifique o esquema: a reflexão pode ignorar restrições UNIQUE antigas embutidas.
    original_objects = connection.exec_driver_sql("""
        SELECT sql FROM sqlite_master
        WHERE tbl_name = 'users' AND type IN ('index', 'trigger') AND sql IS NOT NULL
        ORDER BY type, name
    """).scalars().all()
    op.create_table(
        "users_autoincrement_tmp",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(30), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
        sqlite_autoincrement=True,
    )
    op.execute("""
        INSERT INTO users_autoincrement_tmp (id, username, email, password_hash, created_at, is_superuser)
        SELECT id, username, email, password_hash, created_at, is_superuser FROM users
    """)
    # Se a tabela antiga já usava AUTOINCREMENT, preserve inclusive IDs acima de MAX(id).
    prior_sequence = connection.exec_driver_sql("SELECT seq FROM sqlite_sequence WHERE name = 'users'").scalar()
    op.drop_table("users")
    op.rename_table("users_autoincrement_tmp", "users")
    if prior_sequence is not None:
        connection.exec_driver_sql(
            "INSERT INTO sqlite_sequence (name, seq) SELECT 'users', ? "
            "WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'users')",
            (prior_sequence,),
        )
        connection.exec_driver_sql(
            "UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'users'", (prior_sequence,)
        )
    for ddl in original_objects:
        connection.exec_driver_sql(ddl)
    if connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
        raise RuntimeError("Chaves estrangeiras inválidas após migração de IDs de usuários")


def downgrade():
    raise RuntimeError("Reverter esta revisão permitiria reutilizar IDs de contas excluídas e aceitar tokens antigos.")
