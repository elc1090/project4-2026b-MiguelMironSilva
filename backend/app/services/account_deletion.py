from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import invalid_credentials
from app.models.user import User


@contextmanager
def account_write_transaction(db: Session, actor_id: int) -> Iterator[User]:
    # Release the authentication read transaction before taking the SQLite writer lock.
    db.rollback()
    with db.begin():
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        actor = db.get(User, actor_id, populate_existing=True)
        if actor is None:
            raise invalid_credentials()
        yield actor


def delete_account(db: Session, target: User) -> None:
    # Fail closed if a deleted JWT subject might be assigned to a new account.
    if not db.connection().exec_driver_sql("""
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = 'users' AND instr(upper(sql), ' AUTOINCREMENT') > 0
    """).scalar():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Migração de usuários pendente")

    if target.is_superuser and db.scalar(
        select(User.id).where(User.is_superuser, User.id != target.id).limit(1)
    ) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Não é possível excluir o último superusuário")

    # User.movies cascades in the ORM; User.reviews cascades via its foreign key.
    db.delete(target)
