from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.first_admin import FirstAdminSetup


def close_first_admin_setup(db: Session) -> None:
    """Close setup permanently; caller must hold the SQLite writer lock."""
    if db.get(FirstAdminSetup, 1) is None:
        db.add(FirstAdminSetup(id=1, closed_at=datetime.now(timezone.utc)))
