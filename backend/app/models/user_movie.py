from sqlalchemy import ForeignKey, String, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserMovie(Base):
    __tablename__ = "user_movies"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    tmdb_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    favorite: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )

    watched: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )

    watchlist: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
        server_default=false(),
    )

    user: Mapped["User"] = relationship(
        back_populates="movies",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "tmdb_id",
            name="uq_user_movie",
        ),
    )