"""Operações privilegiadas somente locais; nenhum endpoint HTTP as disponibiliza."""
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.admin_setup_state import close_first_admin_setup
from app.services.auth import password_hash


class SuperuserError(ValueError):
    """Mensagem segura para o operador, sem parâmetros SQL ou credenciais."""


def validate_identity(username: str, email: str = "unused") -> tuple[str, str]:
    try:
        data = UserCreate(username=username, email=email, password="validation-only")
    except ValidationError:
        raise SuperuserError(
            "Dados inválidos: username deve ter 3–30 e email 3–255 caracteres após strip"
        ) from None
    return data.username, data.email.lower()


def create_superuser(db: Session, username: str, email: str, password: str) -> User:
    try:
        try:
            data = UserCreate(username=username, email=email, password=password)
        except ValidationError:
            raise SuperuserError(
                "Dados inválidos: username 3–30 e email 3–255 após strip; senha exata 8–128 caracteres"
            ) from None
        user = User(
            username=data.username,
            email=data.email.lower(),
            password_hash=password_hash.hash(data.password),
            is_superuser=True,
        )
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        db.add(user)
        close_first_admin_setup(db)
        db.commit()
        return user
    except IntegrityError:
        db.rollback()
        raise SuperuserError("Nome de usuário ou e-mail já existe") from None
    except SQLAlchemyError:
        db.rollback()
        raise SuperuserError("Falha no banco; verifique configuração e migração existente") from None
    except Exception:
        db.rollback()
        raise


def promote_superuser(db: Session, username: str) -> User:
    try:
        username, _ = validate_identity(username)
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise SuperuserError("Usuário não encontrado")
        # Altere somente este indicador: nunca substitua senha, e-mail ou dados da conta.
        if not user.is_superuser:
            user.is_superuser = True
        close_first_admin_setup(db)
        db.commit()
        return user
    except SQLAlchemyError:
        db.rollback()
        raise SuperuserError("Falha no banco; verifique configuração e migração existente") from None
    except Exception:
        db.rollback()
        raise
