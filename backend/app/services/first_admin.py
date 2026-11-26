from hashlib import sha256
from hmac import compare_digest
import re
import time

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import invalid_credentials
from app.config import settings
from app.models.first_admin import FirstAdminSetup
from app.models.user import User
from app.schemas.auth import CurrentUserResponse
from app.services.account_deletion import account_write_transaction
from app.services.admin_setup_state import close_first_admin_setup
from app.services.sessions import rotate_user_sessions


_PRIVATE = {"Cache-Control": "no-store"}


def _configured_digest() -> str | None:
    digest = settings.first_admin_code_sha256.get_secret_value().strip().lower()
    expires_at = settings.first_admin_code_expires_at.strip()
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        return None
    if expires_at == "never":
        return digest
    if not re.fullmatch(r"[0-9]{1,12}", expires_at):
        return None
    if int(expires_at) <= time.time():
        return None
    return digest


def _no_admin_and_never_closed(db: Session) -> bool:
    return db.get(FirstAdminSetup, 1) is None and db.scalar(
        select(User.id).where(User.is_superuser.is_(True)).limit(1)
    ) is None


def first_admin_available(db: Session) -> bool:
    return _configured_digest() is not None and _no_admin_and_never_closed(db)


def _closed() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, "A configuração inicial não está disponível", headers=_PRIVATE)


def _wrong_code() -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, "Código de configuração incorreto", headers=_PRIVATE)


def claim_first_admin(db: Session, user: User, code: str) -> tuple[CurrentUserResponse, int]:
    user_id, version = user.id, user.session_version
    configured = _configured_digest()
    if configured is None or not _no_admin_and_never_closed(db):
        raise _closed()
    supplied = sha256(code.encode("ascii")).hexdigest()
    if not compare_digest(supplied, configured):
        raise _wrong_code()

    #Tentativas ocupadas ou inválidas não adquirem um bloqueio de escrita. Uma tentativa válida deve
    #repetir todas as decisões de segurança dentro do mecanismo de bloqueio antes de promover qualquer pessoa.
    with account_write_transaction(db, user_id) as actor:
        if actor.session_version != version:
            raise invalid_credentials()
        configured = _configured_digest()
        if configured is None or not _no_admin_and_never_closed(db):
            raise _closed()
        if not compare_digest(supplied, configured):
            raise _wrong_code()
        actor.is_superuser = True
        close_first_admin_setup(db)
        next_version = rotate_user_sessions(db, actor)
        identity = CurrentUserResponse(
            id=str(actor.id), username=actor.username, email=actor.email, is_superuser=True,
            **({"has_password": False} if not actor.has_password else {}),
        )
    return identity, next_version
