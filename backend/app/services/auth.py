from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.auth import UserCreate


password_hash = PasswordHash.recommended()


def create_user(
    db: Session,
    username: str,
    email: str,
    password: str,
) -> dict:
    data = UserCreate(username=username, email=email, password=password)
    username = data.username
    email = data.email.lower()
    password = data.password

    user = User(
        username=username,
        email=email,
        password_hash=password_hash.hash(password),
        created_at=datetime.now(timezone.utc),
        is_superuser=False,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Nome de usuário ou e-mail já existe"
        ) from exc

    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "is_superuser": user.is_superuser,
    }


def authenticate_user(
    db: Session,
    identifier: str,
    password: str,
):
    identifier = identifier.strip()

    statement = select(User).where(
        or_(
            User.username == identifier,
            User.email == identifier.lower(),
        )
    )

    user = db.scalar(statement)

    if user is None or not verify_current_password(password, user.password_hash):
        return None

    return user


def verify_current_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    try:
        return password_hash.verify(password, stored_hash)
    except (UnknownHashError, UnicodeError):
        # Dados antigos inutilizáveis ou uma senha que não possa ser codificada em UTF-8 não podem corresponder.
        return False


def create_access_token(
    user_id: str,
    expires_minutes: int = 30,
    *,
    session_version: int = 0,
) -> str:
    # A criação de contas locais não precisa de credenciais JWT nem TMDB.
    from app.config import settings

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes
    )

    payload = {
        "sub": user_id,
        "exp": expire,
        "sv": session_version,
        # Tokens de logins diferentes no mesmo segundo continuam distintos.
        "jti": token_urlsafe(24),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm="HS256",
    )