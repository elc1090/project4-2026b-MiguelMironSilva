from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.models import User
from app.services.auth import password_hash
from sqlalchemy import select


PASSWORD = "senha-segura-123"


def register(client, username, email):
    return client.post("/api/auth/register", json={
        "username": username, "email": email, "password": PASSWORD,
    })


def login(client, identifier, password=PASSWORD):
    return client.post("/api/auth/login", data={
        "username": identifier, "password": password,
    })


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def registered_token(client, username, email):
    response = register(client, username, email)
    assert response.status_code == 201, response.text
    response = login(client, username)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_register_login_and_me(client):
    response = register(client, "alice", "ALICE@example.com")
    assert response.status_code == 201
    user = response.json()
    assert user["username"] == "alice"
    assert user["email"] == "alice@example.com"
    assert "password" not in user and "password_hash" not in user
    for identifier in ("alice", "ALICE@example.com"):
        response = login(client, identifier)
        assert response.status_code == 200
        assert response.json()["token_type"] == "bearer"
        me = client.get("/api/auth/me", headers=bearer(response.json()["access_token"]))
        assert me.status_code == 200
        assert me.json() == user


def test_registration_cannot_grant_privileges_and_hashes_password(client, db_session):
    response = client.post("/api/auth/register", json={
        "username": "alice", "email": "alice@example.com", "password": PASSWORD,
        "is_superuser": True, "id": 999,
    })
    assert response.status_code == 201
    user = db_session.scalar(select(User).where(User.username == "alice"))
    assert user.is_superuser is False
    assert user.id != 999
    assert user.password_hash != PASSWORD
    assert password_hash.verify(PASSWORD, user.password_hash)


def test_token_stops_working_after_user_is_deleted(client, db_session):
    token = registered_token(client, "alice", "alice@example.com")
    user = db_session.scalar(select(User).where(User.username == "alice"))
    db_session.delete(user)
    db_session.commit()
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_duplicate_registration_and_bad_credentials(client):
    assert register(client, "alice", "alice@example.com").status_code == 201
    assert register(client, "alice", "other@example.com").status_code == 409
    assert register(client, "other", "ALICE@example.com").status_code == 409
    assert login(client, "alice", "incorrect").status_code == 401
    assert login(client, "missing").status_code == 401
    assert login(client, "alice").status_code == 200


@pytest.mark.parametrize("method,path", [
    ("get", "/api/auth/me"),
    ("get", "/api/my-movies/"),
    ("get", "/api/my-movies/42"),
    ("patch", "/api/my-movies/42"),
    ("delete", "/api/my-movies/42"),
])
def test_protected_routes_require_authentication(client, method, path):
    response = client.request(method, path, json={"favorite": True} if method == "patch" else None)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_invalid_and_expired_tokens_are_rejected(client):
    valid_token = registered_token(client, "alice", "alice@example.com")
    assert client.get("/api/auth/me", headers=bearer(valid_token)).status_code == 200
    now = datetime.now(timezone.utc)
    tokens = [
        "not-a-jwt",
        jwt.encode({"sub": "1", "exp": now + timedelta(minutes=5)}, "wrong-secret-key-that-is-long-enough", algorithm="HS256"),
        jwt.encode({"sub": "1", "exp": now - timedelta(seconds=1)}, settings.jwt_secret_key, algorithm="HS256"),
        jwt.encode({"exp": now + timedelta(minutes=5)}, settings.jwt_secret_key, algorithm="HS256"),
        jwt.encode({"sub": "not-an-id"}, settings.jwt_secret_key, algorithm="HS256"),
        jwt.encode({"sub": "999999"}, settings.jwt_secret_key, algorithm="HS256"),
    ]
    for token in tokens:
        response = client.get("/api/auth/me", headers=bearer(token))
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"


def test_movie_states_are_isolated_for_read_write_and_delete(client):
    alice = bearer(registered_token(client, "alice", "alice@example.com"))
    bob = bearer(registered_token(client, "bobby", "bob@example.com"))
    alice_state = {"tmdb_id": "42", "favorite": True, "watched": False, "rating": 9}
    assert client.patch("/api/my-movies/42", headers=alice, json={"favorite": True, "rating": 9}).json() == alice_state
    assert client.get("/api/my-movies/", headers=bob).json() == []
    assert client.get("/api/my-movies/42", headers=bob).json() == {
        "tmdb_id": "42", "favorite": False, "watched": False, "rating": None,
    }
    assert client.delete("/api/my-movies/42", headers=bob).status_code == 404
    assert client.patch("/api/my-movies/42", headers=bob, json={"watched": True}).status_code == 200
    assert client.get("/api/my-movies/42", headers=alice).json() == alice_state
    assert client.get("/api/my-movies/", headers=alice).json() == [alice_state]
    assert client.delete("/api/my-movies/42", headers=bob).status_code == 200
    assert client.get("/api/my-movies/42", headers=alice).json() == alice_state
    assert client.get("/api/my-movies/", headers=bob).json() == []
