from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.first_admin import FirstAdminSetup


def close_first_admin_setup(db: Session) -> None:
    """Encerra a configuração permanentemente; o chamador deve manter o bloqueio de escrita do SQLite."""
    if db.get(FirstAdminSetup, 1) is None:
        db.add(FirstAdminSetup(id=1, closed_at=datetime.now(timezone.utc)))
