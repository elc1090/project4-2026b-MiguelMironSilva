from datetime import datetime, timezone

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "tmdb_id", name="uq_reviews_user_movie"),
        Index("ix_reviews_tmdb_id", "tmdb_id"),
        CheckConstraint("rating IS NULL OR (rating >= 0 AND rating <= 10)", name="ck_reviews_rating_range"),
        CheckConstraint("text IS NOT NULL OR rating IS NOT NULL", name="ck_reviews_content_present"),
        {"sqlite_autoincrement": True},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tmdb_id: Mapped[int] = mapped_column(BigInteger)
    text: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    rating: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author: Mapped["User"] = relationship(back_populates="reviews")
