"""Adota o schema legado ou cria um banco novo sem apagar dados.

Revision ID: 20261117_01
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "20261117_01"
down_revision = None
branch_labels = None
depends_on = None


def _fail(detail):
    raise RuntimeError("Schema SQLite incompatível com a migração inicial: " + detail)


def _validate(inspector, table, expected, uniques, foreign_keys):
    columns = {column["name"]: column for column in inspector.get_columns(table)}
    if set(columns) != set(expected):
        _fail(f"colunas inesperadas em {table}")
    for name, (kind, nullable, length) in expected.items():
        column = columns[name]
        if not isinstance(column["type"], kind) or column["nullable"] != nullable:
            _fail(f"tipo ou nulidade incompatível em {table}.{name}")
        if length is not None and column["type"].length != length:
            _fail(f"tamanho incompatível em {table}.{name}")
    if inspector.get_pk_constraint(table)["constrained_columns"] != ["id"]:
        _fail(f"chave primária incompatível em {table}")
    # A reflexão de texto SQL do SQLite pode não detectar declarações UNIQUE embutidas. Leia
    # os índices propriamente ditos, incluindo as entradas `sqlite_autoindex`, em vez disso.
    quote = inspector.bind.dialect.identifier_preparer.quote
    actual_uniques = set()
    for index in inspector.bind.exec_driver_sql(f"PRAGMA index_list({quote(table)})").mappings():
        if not index["unique"]:
            continue
        if index["partial"]:
            _fail(f"índice único parcial inesperado em {table}")
        columns_in_index = inspector.bind.exec_driver_sql(
            f"PRAGMA index_info({quote(index['name'])})"
        ).mappings()
        actual_uniques.add(tuple(column["name"] for column in columns_in_index))
    if actual_uniques != uniques:
        _fail(f"restrições únicas incompatíveis em {table}")
    actual_fks = {(tuple(x["constrained_columns"]), x["referred_table"], tuple(x["referred_columns"])) for x in inspector.get_foreign_keys(table)}
    if actual_fks != foreign_keys:
        _fail(f"chaves estrangeiras incompatíveis em {table}")
    if inspector.get_check_constraints(table):
        _fail(f"restrições CHECK inesperadas em {table}")


def upgrade():
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        _fail("esta migração suporta somente SQLite")
    inspector = sa.inspect(connection)
    tables = set(inspector.get_table_names())
    existing = tables & {"users", "user_movies"}
    if existing and existing != {"users", "user_movies"}:
        _fail("as tabelas users e user_movies devem existir juntas")
    if existing:
        user_columns = {
            "id": (sa.Integer, False, None),
            "username": (sa.String, False, 30),
            "email": (sa.String, False, 255),
            "password_hash": (sa.String, False, 255),
            "created_at": (sa.DateTime, False, None),
        }
        if "is_superuser" in {c["name"] for c in inspector.get_columns("users")}:
            user_columns["is_superuser"] = (sa.Boolean, False, None)
        _validate(inspector, "users", user_columns, {("username",), ("email",)}, set())
        _validate(inspector, "user_movies", {
            "id": (sa.Integer, False, None),
            "user_id": (sa.Integer, False, None),
            "tmdb_id": (sa.String, False, 50),
            "favorite": (sa.Boolean, False, None),
            "watched": (sa.Boolean, False, None),
            "rating": (sa.Integer, True, None),
        }, {("user_id", "tmdb_id")}, {(('user_id',), 'users', ('id',))})
        if "is_superuser" not in user_columns:
            op.add_column("users", sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()))
        return

    op.create_table("users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(30), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table("user_movies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tmdb_id", sa.String(50), nullable=False),
        sa.Column("favorite", sa.Boolean(), nullable=False),
        sa.Column("watched", sa.Boolean(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.UniqueConstraint("user_id", "tmdb_id", name="uq_user_movie"),
    )


def downgrade():
    raise RuntimeError("A revisão inicial não pode ser revertida automaticamente sem risco de perda de dados; restaure um backup.")
