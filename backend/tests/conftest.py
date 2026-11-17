"""Isolated API fixtures: no production database, credentials, or HTTP requests."""
import os

# Settings are instantiated during imports; never read a real secret from .env.
os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-at-least-32-characters"
os.environ["TMDB_API_KEY"] = "test-only-unused-key"

import pytest
import requests
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.database as database

# A separate in-memory engine is used for all test requests.
engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)


@event.listens_for(engine, "connect")
def enable_foreign_keys(connection, _record):
    connection.execute("PRAGMA foreign_keys=ON")


from app.main import app  # noqa: E402

TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def db_session(client):
    """Inspect persisted state in the same disposable database as the API."""
    with TestingSession() as session:
        yield session


@pytest.fixture
def client(monkeypatch):
    database.Base.metadata.drop_all(bind=engine)
    database.Base.metadata.create_all(bind=engine)

    def get_test_db():
        with TestingSession() as session:
            yield session

    def deny_network(*args, **kwargs):
        raise AssertionError("Tests must not make external HTTP requests")

    monkeypatch.setattr(requests.sessions.Session, "request", deny_network)
    app.dependency_overrides[database.get_db] = get_test_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        database.Base.metadata.drop_all(bind=engine)
