"""Verify the CLI and HTTP contract together on an Alembic-created database."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import cli
from app.database import get_db
from app.main import app


BACKEND = Path(__file__).resolve().parents[1]


def test_cli_promotion_and_http_authorization_on_migrated_database(client, tmp_path, monkeypatch):
    url = "sqlite:///" + (tmp_path / "superuser-integration.db").as_posix()
    monkeypatch.setenv("ALEMBIC_DATABASE_URL", url)
    config = Config(str(BACKEND / "alembic.ini"))
    command.upgrade(config, "head")
    engine = create_engine(url, connect_args={"check_same_thread": False})
    factory = sessionmaker(bind=engine)

    def isolated_db():
        with factory() as session:
            yield session

    previous_override = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = isolated_db
    monkeypatch.setattr(cli, "SessionLocal", factory)
    try:
        registered = client.post("/api/auth/register", json={
            "username": "operator", "email": "operator@example.com",
            "password": "test-only-integration-password", "is_superuser": True,
        })
        assert registered.status_code == 201
        assert registered.json()["is_superuser"] is False
        logged_in = client.post("/api/auth/login", data={
            "username": "operator", "password": "test-only-integration-password",
        })
        assert logged_in.status_code == 200
        headers = {"Authorization": "Bearer " + logged_in.json()["access_token"]}
        assert client.get("/api/admin/me", headers=headers).status_code == 403
        assert client.patch("/api/my-movies/42", headers=headers, json={"favorite": True}).status_code == 200
        monkeypatch.setattr("builtins.input", lambda prompt: "PROMOVER operator")
        assert cli.main(["promote-superuser", "--username", "operator"]) == 0
        identity = client.get("/api/admin/me", headers=headers)
        assert identity.status_code == 200
        assert identity.json() == {**registered.json(), "is_superuser": True}
        assert client.get("/api/auth/me", headers=headers).json() == identity.json()
        assert client.get("/api/my-movies/42", headers=headers).json()["favorite"] is True
        command.check(config)
    finally:
        app.dependency_overrides[get_db] = previous_override
        engine.dispose()
