from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.auth import get_current_user, invalid_credentials, oauth2_scheme
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    CurrentUserResponse,
    DeleteAccountRequest,
    PasswordUpdateRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from app.services.account_deletion import account_write_transaction, delete_account
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    verify_current_password,
)
from app.services.passwords import update_password


class _AuthRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        if self.methods != {"DELETE"} and not (self.methods == {"PATCH"} and self.path.endswith("/password")):
            return handler

        async def hide_password_validation_input(request: Request) -> Response:
            try:
                return await handler(request)
            except RequestValidationError:
                # FastAPI's default error includes raw input, even for SecretStr.
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, "Corpo da solicitação inválido",
                    headers={"Cache-Control": "no-store"},
                ) from None

        return hide_password_validation_input


router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
    route_class=_AuthRoute,
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user: UserCreate,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        return create_user(
            db=db,
            username=user.username,
            email=user.email,
            password=user.password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    credentials: Annotated[
        OAuth2PasswordRequestForm,
        Depends(),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    user = authenticate_user(
        db=db,
        identifier=credentials.username,
        password=credentials.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nome de usuário ou e-mail inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(str(user.id), session_version=user.session_version)

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    response_model_exclude_unset=True,
)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "is_superuser": current_user.is_superuser,
        **({"has_password": False} if not current_user.has_password else {}),
    }


@router.patch("/password", response_model=TokenResponse)
def change_password(
    body: PasswordUpdateRequest,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
):
    user_id, version = update_password(db, current_user, token, body)
    response.headers["Cache-Control"] = "no-store"
    return {"access_token": create_access_token(str(user_id), session_version=version), "token_type": "bearer"}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    body: DeleteAccountRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    actor_id, stored_hash, version = current_user.id, current_user.password_hash, current_user.session_version
    db.rollback()  # Release the authentication read transaction before verifying.
    password = body.password.get_secret_value()
    verified = verify_current_password(password, stored_hash)

    with account_write_transaction(db, actor_id) as actor:
        if actor.session_version != version:
            raise invalid_credentials()
        # Keep the normal Argon2 check outside the writer lock, but never trust
        # that result if the hash has changed since authentication.
        if actor.password_hash != stored_hash:
            verified = verify_current_password(password, actor.password_hash)
        if not verified:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Senha atual incorreta")
        delete_account(db, actor)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
