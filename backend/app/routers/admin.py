from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_superuser, invalid_credentials
from app.database import get_db
from app.models.user import User
from app.schemas.auth import AdminUserResponse, UserResponse


router = APIRouter(prefix="/api/admin", tags=["admin"])

Database = Annotated[Session, Depends(get_db)]
CurrentSuperuser = Annotated[User, Depends(get_current_superuser)]
SQLiteId = Annotated[int, Path(ge=-(2**63), le=2**63 - 1)]


@router.get("/me", response_model=UserResponse)
def get_admin_me(current_user: CurrentSuperuser):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "is_superuser": current_user.is_superuser,
    }


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(current_user: CurrentSuperuser, db: Database, response: Response):
    response.headers["Cache-Control"] = "no-store"
    rows = db.execute(select(User.id, User.username, User.is_superuser).order_by(User.id))
    return [
        AdminUserResponse(id=str(user_id), username=username, is_superuser=is_superuser)
        for user_id, username, is_superuser in rows
    ]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: SQLiteId, current_user: CurrentSuperuser, db: Database):
    actor_id = current_user.id
    db.rollback()  # Release the authentication read transaction and expire cached data.
    with db.begin():
        # A SQLite transaction with a reserved writer lock serializes cross-deletion.
        # If A deletes B first, B must fail this fresh actor check before deleting A.
        connection = db.connection()
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        actor = db.get(User, actor_id, populate_existing=True)
        if actor is None:
            raise invalid_credentials()
        get_current_superuser(actor)

        if user_id == actor_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Não é possível excluir a própria conta")
        target = db.get(User, user_id)
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")

        # Fail closed if the database was not migrated: deleting from a bare
        # INTEGER PRIMARY KEY table could allow a deleted JWT subject to return.
        if not connection.exec_driver_sql("""
            SELECT 1 FROM sqlite_master
            WHERE type = 'table' AND name = 'users' AND instr(upper(sql), ' AUTOINCREMENT') > 0
        """).scalar():
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Migração de usuários pendente")

        # User.movies cascades in the ORM; User.reviews cascades via its foreign key.
        db.delete(target)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
