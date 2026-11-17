from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

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

    created_at: Mapped[datetime] = mapped_column( #tabela da data de criação da entrada
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    movies: Mapped[list["UserMovie"]] = relationship( #tabela dos filmes relacionados
        back_populates="user",
        cascade="all, delete-orphan",
    )

    is_superuser: Mapped[bool] = mapped_column( #tabela para ver se é superusuário ou não
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
