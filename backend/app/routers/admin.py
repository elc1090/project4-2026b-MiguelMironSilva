from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import get_current_superuser
from app.models.user import User
from app.schemas.auth import UserResponse


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/me", response_model=UserResponse)
def get_admin_me(current_user: Annotated[User, Depends(get_current_superuser)]):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "is_superuser": current_user.is_superuser,
    }
