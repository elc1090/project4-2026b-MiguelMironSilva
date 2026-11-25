from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GoogleIdentity(Base):
    __tablename__ = "google_identities"

    subject: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)


class GoogleLoginAttempt(Base):
    __tablename__ = "google_login_attempts"

    state_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    browser_hash: Mapped[str] = mapped_column(String(64))
    frontend_challenge: Mapped[str] = mapped_column(String(43))
    nonce: Mapped[str] = mapped_column(String(43))
    google_verifier: Mapped[str] = mapped_column(String(43))
    expires_at: Mapped[int] = mapped_column(index=True)


class GoogleLoginGrant(Base):
    __tablename__ = "google_login_grants"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    challenge: Mapped[str] = mapped_column(String(43))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[int] = mapped_column(index=True)


class GooglePasswordAttempt(Base):
    __tablename__ = "google_password_attempts"

    ticket_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    browser_hash: Mapped[str | None] = mapped_column(String(64))
    frontend_challenge: Mapped[str] = mapped_column(String(43))
    nonce: Mapped[str] = mapped_column(String(43))
    google_verifier: Mapped[str] = mapped_column(String(43))
    started_at: Mapped[int]
    expires_at: Mapped[int] = mapped_column(index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_version: Mapped[int]
    session_digest: Mapped[str] = mapped_column(String(64))


class GooglePasswordProof(Base):
    __tablename__ = "google_password_proofs"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    challenge: Mapped[str] = mapped_column(String(43))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_version: Mapped[int]
    session_digest: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[int] = mapped_column(index=True)
