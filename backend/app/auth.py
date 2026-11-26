from typing import Annotated
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)


def invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
):
    if not token.isascii():
        raise invalid_credentials()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
        )

        # Tokens antigos podem sobreviver à migração, mas não à primeira rotação.
        version = payload.get("sv", 0)
        if type(version) is not int or version < 0:
            raise invalid_credentials()
        user_id = payload.get("sub")

        if user_id is None:
            raise invalid_credentials()

        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            raise invalid_credentials()
        if not -(2**63) <= user_id <= 2**63 - 1:
            raise invalid_credentials()

        user = db.scalar(
            select(User).where(User.id == user_id)
        )

        if user is None or user.session_version != version:
            raise invalid_credentials()

        return user

    except InvalidTokenError:
        raise invalid_credentials()


def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    # Autorize com o registro atual do banco, nunca com declarações de papel do token.
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a superusuários",
        )
    return current_user