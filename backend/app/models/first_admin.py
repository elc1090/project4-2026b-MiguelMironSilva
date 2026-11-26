from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FirstAdminSetup(Base):
    """Marcador durável de encerramento, independente de qualquer administrador específico."""

    __tablename__ = "first_admin_setup"
    __table_args__ = (CheckConstraint("id = 1", name="ck_first_admin_setup_singleton"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
