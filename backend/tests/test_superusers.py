"""All service/CLI/API operations use the disposable fixture database, never the real DB."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import getpass
import warnings

import jwt
import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app import cli
from app.config import settings
from app.models.user import User
from app.services.auth import create_access_token, create_user, password_hash
from app.services.superusers import SuperuserError, create_superuser, promote_superuser


PASSWORD = "test-only-password-123"


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_registration_contract_and_ignored_extras(client, db_session):
    response = client.post("/api/auth/register", json={
        "username": " alice ", "email": " ALICE@example.com ", "password": PASSWORD,
        "is_superuser": True, "role": "admin", "id": 999,
    })
    assert response.status_code == 201
    data = response.json()
    assert set(data) == {"id", "username", "email", "is_superuser"}
    assert data["is_superuser"] is False
    assert data["username"] == "alice" and data["email"] == "alice@example.com"
    assert db_session.get(User, int(data["id"])).is_superuser is False
    token = create_access_token(data["id"])
    assert client.get("/api/auth/me", headers=bearer(token)).json() == data


def test_registration_preserves_password_spaces(client):
    secret = "  senha-exata-123  "
    response = client.post("/api/auth/register", json={
        "username": "alice", "email": "alice@example.com", "password": secret,
    })
    assert response.status_code == 201
    assert client.post("/api/auth/login", data={"username": "alice", "password": secret}).status_code == 200
    assert client.post("/api/auth/login", data={"username": "alice", "password": secret.strip()}).status_code == 401


def test_superuser_preserves_password_spaces(db_session):
    secret = "  senha-exata-123  "
    user = create_superuser(db_session, "admin", "admin@example.com", secret)
    assert password_hash.verify(secret, user.password_hash)
    assert not password_hash.verify(secret.strip(), user.password_hash)


def test_admin_authorization_current_role_same_token(client, db_session):
    assert client.get("/api/admin/me").status_code == 401
    user_data = create_user(db_session, "alice", "alice@example.com", PASSWORD)
    token = create_access_token(user_data["id"])
    headers = bearer(token)
    assert client.get("/api/admin/me", headers=headers).status_code == 403
    promote_superuser(db_session, "alice")
    result = client.get("/api/admin/me", headers=headers)
    assert result.status_code == 200
    assert result.json()["is_superuser"] is True
    assert result.json() == client.get("/api/auth/me", headers=headers).json()
    user = db_session.get(User, int(user_data["id"]))
    user.is_superuser = False
    db_session.commit()
    assert client.get("/api/admin/me", headers=headers).status_code == 403
    assert client.get("/api/auth/me", headers=headers).json()["is_superuser"] is False
    db_session.delete(user)
    db_session.commit()
    assert client.get("/api/admin/me", headers=headers).status_code == 401


def test_even_signed_role_claims_cannot_elevate(client, db_session):
    data = create_user(db_session, "alice", "alice@example.com", PASSWORD)
    token = jwt.encode({
        "sub": data["id"], "is_superuser": True, "role": "admin", "roles": ["superuser"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }, settings.jwt_secret_key, algorithm="HS256")
    assert client.get("/api/admin/me", headers=bearer(token)).status_code == 403
    assert client.get("/api/auth/me", headers=bearer(token)).json()["is_superuser"] is False
    assert client.get("/api/admin/me", headers=bearer("invalid-token")).status_code == 401
    assert client.post("/api/admin/promote", json={"username": "alice"}).status_code == 404


def test_create_service_normalizes_hashes_and_promote_preserves_data(db_session):
    admin = create_superuser(db_session, " admin ", " ADMIN@example.com ", PASSWORD)
    assert admin.username == "admin" and admin.email == "admin@example.com"
    assert admin.is_superuser is True
    assert admin.password_hash != PASSWORD
    assert password_hash.verify(PASSWORD, admin.password_hash)
    data = create_user(db_session, "alice", "alice@example.com", PASSWORD)
    user = db_session.get(User, int(data["id"]))
    snapshot = (user.id, user.username, user.email, user.password_hash, user.created_at)
    for _ in range(2):
        promoted = promote_superuser(db_session, " alice ")
        assert promoted.is_superuser is True
        assert (promoted.id, promoted.username, promoted.email, promoted.password_hash, promoted.created_at) == snapshot


@pytest.mark.parametrize("field,value", [
    ("username", "  ab  "), ("username", "u" * 31),
    ("email", "  ab  "), ("email", "e" * 256),
    ("password", "short"), ("password", "p" * 129),
])
def test_create_service_rejects_invalid_inputs(db_session, field, value):
    args = {"username": "alice", "email": "alice@example.com", "password": PASSWORD}
    args[field] = value
    with pytest.raises(SuperuserError, match="Dados inválidos"):
        create_superuser(db_session, **args)
    assert db_session.scalar(select(User)) is None


def test_service_accepts_boundary_lengths_after_strip(db_session):
    user = create_superuser(db_session, " " + "u" * 30 + " ", " " + "e" * 255 + " ", "p" * 128)
    assert len(user.username) == 30 and len(user.email) == 255
    assert password_hash.verify("p" * 128, user.password_hash)


@pytest.mark.parametrize("username,email", [("alice", "other@example.com"), ("other", "ALICE@example.com")])
def test_duplicate_service_rolls_back_and_session_recovers(db_session, username, email):
    create_superuser(db_session, "alice", "alice@example.com", PASSWORD)
    with pytest.raises(SuperuserError, match="já existe"):
        create_superuser(db_session, username, email, PASSWORD)
    assert len(db_session.scalars(select(User)).all()) == 1
    assert create_superuser(db_session, "valid", "valid@example.com", PASSWORD).is_superuser


def test_promote_missing_and_invalid_username(db_session):
    with pytest.raises(SuperuserError, match="não encontrado"):
        promote_superuser(db_session, "missing")
    with pytest.raises(SuperuserError, match="Dados inválidos"):
        promote_superuser(db_session, "  ab ")
    assert db_session.scalar(select(User)) is None


@pytest.mark.parametrize("operation", ["create", "promote"])
def test_database_failure_rolls_back_without_sql_or_secrets(db_session, monkeypatch, operation):
    data = create_user(db_session, "alice", "alice@example.com", PASSWORD)
    def fail():
        raise OperationalError("SECRET SQL", {"password": PASSWORD}, Exception("SECRET"))
    with monkeypatch.context() as patch:
        patch.setattr(db_session, "commit", fail)
        with pytest.raises(SuperuserError) as error:
            if operation == "create":
                create_superuser(db_session, "admin", "admin@example.com", PASSWORD)
            else:
                promote_superuser(db_session, "alice")
    assert "SECRET" not in str(error.value) and PASSWORD not in str(error.value)
    assert db_session.get(User, int(data["id"])).is_superuser is False
    assert len(db_session.scalars(select(User)).all()) == 1


@pytest.fixture
def cli_db(monkeypatch, db_session):
    @contextmanager
    def session():
        yield db_session
    monkeypatch.setattr(cli, "SessionLocal", session)
    return db_session


def passwords(monkeypatch, values):
    answers = iter(values)
    monkeypatch.setattr(cli.getpass, "getpass", lambda prompt: next(answers))


def test_cli_create_and_promote_success_and_idempotence(cli_db, monkeypatch, capsys):
    passwords(monkeypatch, [PASSWORD, PASSWORD])
    assert cli.main(["create-superuser", "--username", " admin ", "--email", " ADMIN@example.com "]) == 0
    admin = cli_db.scalar(select(User).where(User.username == "admin"))
    assert admin.is_superuser and password_hash.verify(PASSWORD, admin.password_hash)
    data = create_user(cli_db, "alice", "alice@example.com", PASSWORD)
    user = cli_db.get(User, int(data["id"]))
    snapshot = (user.password_hash, user.email, user.created_at)
    monkeypatch.setattr("builtins.input", lambda prompt: "PROMOVER alice")
    for _ in range(2):
        assert cli.main(["promote-superuser", "--username", " alice "]) == 0
    assert user.is_superuser
    assert (user.password_hash, user.email, user.created_at) == snapshot
    captured = capsys.readouterr()
    assert PASSWORD not in captured.out + captured.err


@pytest.mark.parametrize("command", [
    ["create-superuser", "--username", "ab", "--email", "valid@example.com"],
    ["create-superuser", "--username", "alice", "--email", " a "],
    ["promote-superuser", "--username", "ab"],
])
def test_cli_validates_before_prompt_or_db(cli_db, monkeypatch, command):
    def unexpected(*args):
        pytest.fail("Invalid identity must fail before prompting")
    monkeypatch.setattr(cli.getpass, "getpass", unexpected)
    monkeypatch.setattr("builtins.input", unexpected)
    assert cli.main(command) == 1
    assert cli_db.scalar(select(User)) is None


@pytest.mark.parametrize("values", [[PASSWORD, "different"], ["short", "short"]])
def test_cli_password_errors_leave_no_user(cli_db, monkeypatch, values, capsys):
    passwords(monkeypatch, values)
    assert cli.main(["create-superuser", "--username", "admin", "--email", "admin@example.com"]) == 1
    assert cli_db.scalar(select(User)) is None
    output = capsys.readouterr()
    assert all(value not in output.err for value in values)


def test_cli_duplicate_and_missing_are_errors(cli_db, monkeypatch, capsys):
    create_superuser(cli_db, "admin", "admin@example.com", PASSWORD)
    passwords(monkeypatch, [PASSWORD, PASSWORD])
    assert cli.main(["create-superuser", "--username", "admin", "--email", "other@example.com"]) == 1
    monkeypatch.setattr("builtins.input", lambda prompt: "PROMOVER missing")
    assert cli.main(["promote-superuser", "--username", "missing"]) == 1
    assert len(cli_db.scalars(select(User)).all()) == 1
    assert PASSWORD not in capsys.readouterr().err


@pytest.mark.parametrize("confirmation", ["", "yes", "sim", "PROMOVER wrong"])
def test_cli_promotion_requires_exact_confirmation(cli_db, monkeypatch, confirmation):
    data = create_user(cli_db, "alice", "alice@example.com", PASSWORD)
    monkeypatch.setattr("builtins.input", lambda prompt: confirmation)
    assert cli.main(["promote-superuser", "--username", "alice"]) == 1
    assert cli_db.get(User, int(data["id"])).is_superuser is False


@pytest.mark.parametrize("failure", [EOFError, KeyboardInterrupt, getpass.GetPassWarning])
def test_cli_interrupt_and_unsafe_terminal_do_not_write(cli_db, monkeypatch, capsys, failure):
    def fail(prompt):
        if failure is getpass.GetPassWarning:
            warnings.warn("Password input may be echoed", getpass.GetPassWarning)
        else:
            raise failure()
    monkeypatch.setattr(cli.getpass, "getpass", fail)
    assert cli.main(["create-superuser", "--username", "admin", "--email", "admin@example.com"]) == 1
    assert cli_db.scalar(select(User)) is None
    output = capsys.readouterr().err
    assert "Traceback" not in output
    assert ("terminal seguro" if failure is getpass.GetPassWarning else "Operação cancelada") in output


def test_cli_rejects_password_argument(cli_db, capsys):
    with pytest.raises(SystemExit) as error:
        cli.main(["create-superuser", "--username", "admin", "--email", "admin@example.com", "--password", PASSWORD])
    assert error.value.code == 2
    assert PASSWORD not in capsys.readouterr().err
    assert cli_db.scalar(select(User)) is None


def test_cli_sanitizes_unexpected_failure(cli_db, monkeypatch, capsys):
    passwords(monkeypatch, [PASSWORD, PASSWORD])
    def fail(*args):
        raise RuntimeError(f"SQL parameters: {PASSWORD}")
    monkeypatch.setattr(cli, "create_superuser", fail)
    assert cli.main(["create-superuser", "--username", "admin", "--email", "admin@example.com"]) == 1
    captured = capsys.readouterr()
    assert PASSWORD not in captured.out + captured.err
    assert "SQL parameters" not in captured.err
