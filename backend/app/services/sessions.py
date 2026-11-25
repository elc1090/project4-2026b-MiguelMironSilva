from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.google_login import GoogleLoginGrant, GooglePasswordAttempt, GooglePasswordProof
from app.models.user import User


def rotate_user_sessions(db: Session, user: User) -> int:
    """Revoke old sessions and pending Google grants inside the caller's transaction."""
    user.session_version += 1
    for model in (GoogleLoginGrant, GooglePasswordAttempt, GooglePasswordProof):
        db.execute(delete(model).where(model.user_id == user.id))
    return user.session_version
