import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, SecretStr, field_validator
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auth import CurrentUserResponse, TokenResponse
from app.services.auth import create_access_token
from app.services.first_admin import claim_first_admin, first_admin_available


_PRIVATE = {"Cache-Control": "no-store"}


class _PrivateRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def sanitized_handler(request: Request):
            try:
                return await handler(request)
            except RequestValidationError:
                # Default validation responses can contain the submitted code.
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                                    "Corpo da solicitação inválido", headers=_PRIVATE) from None

        return sanitized_handler


class FirstAdminClaim(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: SecretStr

    @field_validator("code")
    @classmethod
    def validate_format(cls, value: SecretStr) -> SecretStr:
        if not re.fullmatch(r"[A-Za-z0-9_-]{43}", value.get_secret_value()):
            raise ValueError("Formato de código inválido")
        return value


class FirstAdminStatus(BaseModel):
    available: bool


class FirstAdminResponse(TokenResponse):
    user: CurrentUserResponse


router = APIRouter(prefix="/api/auth/first-admin", tags=["auth"], route_class=_PrivateRoute)
CurrentUser = Annotated[User, Depends(get_current_user)]
Database = Annotated[Session, Depends(get_db)]


@router.get("", response_model=FirstAdminStatus)
def get_status(_user: CurrentUser, db: Database, response: Response):
    response.headers.update(_PRIVATE)
    return FirstAdminStatus(available=first_admin_available(db))


@router.post("", response_model=FirstAdminResponse, response_model_exclude_unset=True)
def redeem(body: FirstAdminClaim, user: CurrentUser, db: Database, response: Response):
    identity, next_version = claim_first_admin(db, user, body.code.get_secret_value())
    response.headers.update(_PRIVATE)
    return FirstAdminResponse(
        access_token=create_access_token(identity.id, session_version=next_version),
        token_type="bearer",
        user=identity,
    )
