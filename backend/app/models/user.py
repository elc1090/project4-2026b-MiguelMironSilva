from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"
    # User IDs are JWT subjects and must not be allocated to a second account.
    __table_args__ = {"sqlite_autoincrement": True}

    id: Mapped[int] = mapped_column( #tabela das ids do usuário
        primary_key=True,
        autoincrement=True,
    )

    username: Mapped[str] = mapped_column( #tabela dos nomes de usuário
        String(30),
        unique=True,
        nullable=False,
    )

    email: Mapped[str] = mapped_column( #tabela dos emails de usuário
        String(255),
        unique=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column( #tabela das hashs das senhas de usuário
        String(255),
        nullable=False,
    )

    # Incrementing this counter invalidates all previously issued session tokens.
    session_version: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")

    @property
    def has_password(self) -> bool:
        # An empty value explicitly marks Google-only accounts; it is not a hash.
        return bool(self.password_hash)

    created_at: Mapped[datetime] = mapped_column( #tabela da data de criação da entrada
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    movies: Mapped[list["UserMovie"]] = relationship( #tabela dos filmes relacionados
        back_populates="user",
        cascade="all, delete-orphan",
    )

    reviews: Mapped[list["Review"]] = relationship(
        back_populates="author",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    is_superuser: Mapped[bool] = mapped_column( #tabela para ver se é superusuário ou não
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
