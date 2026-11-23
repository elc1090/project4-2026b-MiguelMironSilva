import base64
import hashlib
import re
import secrets
import time
from functools import partial
from urllib.parse import urlencode

import requests
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.google_login import GoogleIdentity, GoogleLoginAttempt, GoogleLoginGrant
from app.models.user import User


ATTEMPT_TTL = 600
GRANT_TTL = 60
_SECRET = re.compile(r"[A-Za-z0-9_-]{43}")


class InvalidGoogleIdentity(Exception):
    pass


class GoogleEmailConflict(Exception):
    pass


def is_secret(value: str | None) -> bool:
    return isinstance(value, str) and _SECRET.fullmatch(value) is not None


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def challenge_for(verifier: str) -> str:
    value = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def begin_login(db: Session, browser_secret: str, frontend_challenge: str) -> str:
    state, nonce, verifier = new_secret(), new_secret(), new_secret()
    now = int(time.time())
    db.execute(delete(GoogleLoginAttempt).where(GoogleLoginAttempt.expires_at <= now))
    db.execute(delete(GoogleLoginGrant).where(GoogleLoginGrant.expires_at <= now))
    db.add(GoogleLoginAttempt(
        state_hash=digest(state), browser_hash=digest(browser_secret),
        frontend_challenge=frontend_challenge, nonce=nonce, google_verifier=verifier,
        expires_at=now + ATTEMPT_TTL,
    ))
    db.commit()
    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge_for(verifier),
        "code_challenge_method": "S256",
        "prompt": "select_account",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


def consume_attempt(db: Session, state: str, browser_secret: str):
    result = db.execute(delete(GoogleLoginAttempt).where(
        GoogleLoginAttempt.state_hash == digest(state),
        GoogleLoginAttempt.browser_hash == digest(browser_secret),
        GoogleLoginAttempt.expires_at > int(time.time()),
    ).returning(
        GoogleLoginAttempt.nonce, GoogleLoginAttempt.google_verifier,
        GoogleLoginAttempt.frontend_challenge,
    )).one_or_none()
    db.commit()
    return result


def verify_google_code(code: str, verifier: str, nonce: str) -> tuple[str, str]:
    try:
        with requests.Session() as session:
            response = session.post("https://oauth2.googleapis.com/token", data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret.get_secret_value(),
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": verifier,
            }, timeout=10, allow_redirects=False)
            if response.status_code != 200:
                raise InvalidGoogleIdentity()
            token = response.json()["id_token"]
            if not isinstance(token, str) or not token:
                raise InvalidGoogleIdentity()
            claims = id_token.verify_oauth2_token(
                token, partial(GoogleRequest(session), timeout=10), settings.google_client_id,
            )
    except (requests.RequestException, GoogleAuthError, ValueError, KeyError, TypeError) as exc:
        raise InvalidGoogleIdentity() from exc

    subject, email = claims.get("sub"), claims.get("email")
    email = email.strip().lower() if isinstance(email, str) else ""
    if (claims.get("nonce") != nonce or claims.get("email_verified") is not True
            or not isinstance(subject, str) or not 1 <= len(subject) <= 255
            or len(email) > 255 or re.fullmatch(r"[^\s@]+@[^\s@]+", email) is None):
        raise InvalidGoogleIdentity()
    return subject, email


def issue_grant(db: Session, subject: str, email: str, challenge: str) -> str:
    code = new_secret()
    with db.begin():
        # Serialize account provisioning with existing SQLite writers. Never claim
        # an existing (possibly privileged) account by its email address.
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        identity = db.get(GoogleIdentity, subject)
        if identity is None:
            if db.scalar(select(User.id).where(User.email == email)) is not None:
                raise GoogleEmailConflict()
            username = "google_" + secrets.token_hex(8)
            while db.scalar(select(User.id).where(User.username == username)) is not None:
                username = "google_" + secrets.token_hex(8)
            user = User(username=username, email=email, password_hash="", is_superuser=False)
            db.add(user)
            db.flush()
            identity = GoogleIdentity(subject=subject, user_id=user.id)
            db.add(identity)
        db.add(GoogleLoginGrant(code_hash=digest(code), challenge=challenge,
                                user_id=identity.user_id, expires_at=int(time.time()) + GRANT_TTL))
    return code


def consume_grant(db: Session, code: str, verifier: str) -> int | None:
    user_id = db.execute(delete(GoogleLoginGrant).where(
        GoogleLoginGrant.code_hash == digest(code),
        GoogleLoginGrant.challenge == challenge_for(verifier),
        GoogleLoginGrant.expires_at > int(time.time()),
    ).returning(GoogleLoginGrant.user_id)).scalar_one_or_none()
    db.commit()
    return user_id
