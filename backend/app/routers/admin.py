from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_superuser
from app.database import get_db
from app.models.user import User
from app.schemas.auth import AdminUserResponse, UserResponse
from app.services.account_deletion import account_write_transaction, delete_account


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


@router.post("/users/{user_id}/promote", response_model=AdminUserResponse)
def promote_user(user_id: SQLiteId, current_user: CurrentSuperuser, db: Database, response: Response):
    actor_id = current_user.id
    with account_write_transaction(db, actor_id) as actor:
        get_current_superuser(actor)
        target = db.get(User, user_id)
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")
        target.is_superuser = True
        promoted = AdminUserResponse(id=str(target.id), username=target.username, is_superuser=True)
    response.headers["Cache-Control"] = "no-store"
    return promoted


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: SQLiteId, current_user: CurrentSuperuser, db: Database):
    actor_id = current_user.id
    with account_write_transaction(db, actor_id) as actor:
        get_current_superuser(actor)

        if user_id == actor_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Não é possível excluir a própria conta")
        target = db.get(User, user_id)
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")

        delete_account(db, target)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
