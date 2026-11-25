from hashlib import sha256

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth import invalid_credentials
from app.models.user import User
from app.schemas.auth import PasswordUpdateRequest
from app.services.account_deletion import account_write_transaction
from app.services.auth import password_hash, verify_current_password
from app.services.google_password import consume_proof
from app.services.sessions import rotate_user_sessions


def update_password(db: Session, user: User, token: str, body: PasswordUpdateRequest) -> tuple[int, int]:
    user_id, version, stored_hash = user.id, user.session_version, user.password_hash
    # Do not hold SQLite's write lock while verifying or hashing a password.
    db.rollback()
    if body.current_password is not None:
        if not stored_hash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Confirme a identidade com o Google antes de definir a senha")
        if not verify_current_password(body.current_password.get_secret_value(), stored_hash):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Senha atual incorreta")
    elif stored_hash:
        raise HTTPException(status.HTTP_409_CONFLICT, "A conta já tem senha; informe a senha atual")

    new_hash = password_hash.hash(body.new_password.get_secret_value())
    with account_write_transaction(db, user_id) as actor:
        if actor.session_version != version:
            raise invalid_credentials()
        if actor.password_hash != stored_hash:
            raise HTTPException(status.HTTP_409_CONFLICT, "A senha da conta mudou; tente novamente")
        if body.current_password is None and not consume_proof(
            db,
            code=body.code,
            verifier=body.verifier,
            user_id=user_id,
            session_version=version,
            session_digest=sha256(token.encode("utf-8")).hexdigest(),
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Confirmação Google inválida ou expirada")
        actor.password_hash = new_hash
        next_version = rotate_user_sessions(db, actor)

    return user_id, next_version
