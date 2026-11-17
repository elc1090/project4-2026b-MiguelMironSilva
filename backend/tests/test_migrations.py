"""Exercise the real Alembic upgrade on disposable SQLite databases only."""
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base
from app.models import User, UserMovie


BACKEND = Path(__file__).resolve().parents[1]
REVISION = "20261117_01"


@pytest.fixture
def migration_db(tmp_path, monkeypatch):
    url = "sqlite:///" + (tmp_path / "migration.db").as_posix()
    monkeypatch.setenv("ALEMBIC_DATABASE_URL", url)
    engine = create_engine(url)
    try:
        yield engine, Config(str(BACKEND / "alembic.ini"))
    finally:
        engine.dispose()


def revision(engine):
    with engine.connect() as connection:
        return connection.scalar(text("SELECT version_num FROM alembic_version"))


def legacy_database(engine, inline_unique=False):
    # Fixed pre-Alembic schema, deliberately independent of current ORM metadata.
    unique = " UNIQUE" if inline_unique else ""
    constraints = "" if inline_unique else ", UNIQUE (username), UNIQUE (email)"
    with engine.begin() as connection:
        connection.exec_driver_sql(f"""
            CREATE TABLE users (
                id INTEGER NOT NULL PRIMARY KEY,
                username VARCHAR(30) NOT NULL{unique},
                email VARCHAR(255) NOT NULL{unique},
                password_hash VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL{constraints}
            )
        """)
        connection.exec_driver_sql("""
            CREATE TABLE user_movies (
                id INTEGER NOT NULL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                tmdb_id VARCHAR(50) NOT NULL,
                favorite BOOLEAN NOT NULL,
                watched BOOLEAN NOT NULL,
                rating INTEGER,
                CONSTRAINT uq_user_movie UNIQUE (user_id, tmdb_id)
            )
        """)
        connection.exec_driver_sql("""
            INSERT INTO users VALUES
            (7, 'alice', 'alice@example.com', 'stored-hash', '2026-01-01 12:00:00')
        """)
        connection.exec_driver_sql("""
            INSERT INTO user_movies VALUES (11, 7, '42', 1, 0, 9)
        """)


def test_empty_database_upgrade_matches_models_and_is_repeatable(migration_db):
    engine, config = migration_db
    command.upgrade(config, "head")
    assert revision(engine) == REVISION
    assert set(inspect(engine).get_table_names()) == {"alembic_version", "users", "user_movies"}
    for table in Base.metadata.sorted_tables:
        actual = {c["name"]: c for c in inspect(engine).get_columns(table.name)}
        assert set(actual) == set(table.columns.keys())
        for column in table.columns:
            assert actual[column.name]["nullable"] == column.nullable
    with Session(engine) as session:
        user = User(username="alice", email="alice@example.com", password_hash="stored-hash")
        session.add(user)
        session.commit()
        assert user.is_superuser is False
        session.add(UserMovie(user_id=user.id, tmdb_id="42", favorite=True))
        session.commit()
    command.upgrade(config, "head")
    command.check(config)  # No schema drift between the new database and ORM models.
    assert revision(engine) == REVISION
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT COUNT(*) FROM users")) == 1
        assert connection.scalar(text("SELECT COUNT(*) FROM user_movies")) == 1


@pytest.mark.parametrize("inline_unique", [False, True])
def test_legacy_upgrade_preserves_rows_and_defaults_to_non_admin(migration_db, inline_unique):
    engine, config = migration_db
    legacy_database(engine, inline_unique=inline_unique)
    with engine.connect() as connection:
        users = connection.exec_driver_sql("SELECT * FROM users").all()
        movies = connection.exec_driver_sql("SELECT * FROM user_movies").all()
    command.upgrade(config, "head")
    assert revision(engine) == REVISION
    with engine.begin() as connection:
        assert connection.exec_driver_sql("SELECT id, username, email, password_hash, created_at FROM users").all() == users
        assert connection.exec_driver_sql("SELECT * FROM user_movies").all() == movies
        assert connection.scalar(text("SELECT is_superuser FROM users WHERE id = 7")) == 0
        connection.exec_driver_sql("""
            INSERT INTO users (username, email, password_hash, created_at)
            VALUES ('bobby', 'bob@example.com', 'another-hash', '2026-01-02')
        """)
        assert connection.scalar(text("SELECT is_superuser FROM users WHERE username = 'bobby'")) == 0
    # SQLAlchemy's generic autogenerate reflection misses the inline form,
    # although SQLite enforces it. Check schema drift on the ORM-style form
    # and exercise the actual constraints on both forms below.
    if not inline_unique:
        command.check(config)
    with engine.begin() as connection:
        for username, email in [("alice", "new@example.com"), ("other", "alice@example.com")]:
            with pytest.raises(IntegrityError):
                connection.exec_driver_sql(
                    "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, 'hash', '2026-01-01')",
                    (username, email),
                )
        with pytest.raises(IntegrityError):
            connection.exec_driver_sql("INSERT INTO user_movies VALUES (12, 7, '42', 0, 1, NULL)")
    assert inspect(engine).get_foreign_keys("user_movies")[0]["referred_table"] == "users"


def test_baseline_downgrade_is_refused_without_removing_data(migration_db):
    engine, config = migration_db
    legacy_database(engine)
    command.upgrade(config, "head")
    with pytest.raises(RuntimeError, match="não pode ser revertida"):
        command.downgrade(config, "base")
    assert revision(engine) == REVISION
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT COUNT(*) FROM users")) == 1
        assert connection.scalar(text("SELECT COUNT(*) FROM user_movies")) == 1


@pytest.mark.parametrize("with_server_default", [True, False])
def test_adopts_current_schema_preserving_existing_superuser(migration_db, with_server_default):
    engine, config = migration_db
    if with_server_default:
        Base.metadata.create_all(engine)
    else:
        # Simulate the schema created by the ORM before a SQL default was added.
        schema = MetaData()
        for table in Base.metadata.sorted_tables:
            table.to_metadata(schema)
        schema.tables["users"].c.is_superuser.server_default = None
        schema.create_all(engine)
    with Session(engine) as session:
        session.add(User(username="admin", email="admin@example.com", password_hash="stored-hash", is_superuser=True))
        session.commit()
    command.upgrade(config, "head")
    with Session(engine) as session:
        assert session.query(User).one().is_superuser is True
    assert revision(engine) == REVISION


@pytest.mark.parametrize("incompatible", ["partial", "missing_unique", "extra_column"])
def test_rejects_incompatible_schema_without_stamping_or_adding_column(migration_db, incompatible):
    engine, config = migration_db
    if incompatible == "partial":
        with engine.begin() as connection:
            connection.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
    else:
        legacy_database(engine)
        with engine.begin() as connection:
            if incompatible == "missing_unique":
                connection.exec_driver_sql("DROP TABLE user_movies")
                connection.exec_driver_sql("""
                    CREATE TABLE user_movies (
                        id INTEGER NOT NULL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        tmdb_id VARCHAR(50) NOT NULL,
                        favorite BOOLEAN NOT NULL, watched BOOLEAN NOT NULL, rating INTEGER
                    )
                """)
            else:
                connection.exec_driver_sql("ALTER TABLE users ADD COLUMN unexpected TEXT")
    with pytest.raises(RuntimeError, match="Schema SQLite incompatível"):
        command.upgrade(config, "head")
    assert "is_superuser" not in {c["name"] for c in inspect(engine).get_columns("users")}
    if "alembic_version" in inspect(engine).get_table_names():
        assert revision(engine) is None

