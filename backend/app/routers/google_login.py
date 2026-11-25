from typing import Annotated
from urllib.parse import urlencode, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user, oauth2_scheme
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import GoogleExchangeRequest, GooglePasswordStartRequest, TokenResponse
from app.services import google_login as google, google_password
from app.services.auth import create_access_token


router = APIRouter(prefix="/api/auth/google", tags=["auth"])
Db = Annotated[Session, Depends(get_db)]
COOKIE = "google_login_browser"
PRIVATE_HEADERS = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}


def enabled() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret.get_secret_value())


def return_to_frontend(**values: str) -> RedirectResponse:
    # Fixed origin from server configuration; no provider or caller input is reflected.
    return RedirectResponse(f"{settings.frontend_url}/#{urlencode(values)}",
                            status_code=303, headers=PRIVATE_HEADERS)


@router.get("/status")
def google_status():
    return {"enabled": enabled()}


@router.get("")
def start_google_login(request: Request, db: Db):
    if not enabled():
        return return_to_frontend(google_error="disabled")
    challenge = request.query_params.get("challenge")
    if not google.is_secret(challenge):
        return return_to_frontend(google_error="invalid")
    browser = request.cookies.get(COOKIE)
    if not google.is_secret(browser):
        browser = google.new_secret()
    response = RedirectResponse(google.begin_login(db, browser, challenge),
                                status_code=303, headers=PRIVATE_HEADERS)
    callback = urlsplit(settings.google_redirect_uri)
    response.set_cookie(COOKIE, browser, max_age=google.ATTEMPT_TTL,
                        path=callback.path.rsplit("/", 1)[0], httponly=True,
                        secure=callback.scheme == "https", samesite="lax")
    return response


@router.post("/password/start")
def start_google_password(
    body: GooglePasswordStartRequest, response: Response, db: Db,
    user: Annotated[User, Depends(get_current_user)],
    token: Annotated[str, Depends(oauth2_scheme)],
):
    if not enabled():
        raise HTTPException(503, "Login Google desativado", headers=PRIVATE_HEADERS)
    try:
        authorization_url = google_password.start(
            db, user_id=user.id, session_version=user.session_version,
            session_digest=google.digest(token), challenge=body.challenge,
        )
    except google_password.PasswordFlowError as exc:
        code, detail = {
            "not_linked": (403, "Nenhuma conta Google vinculada"),
            "already_password": (409, "Sua conta já tem senha"),
        }.get(exc.code, (401, "Sessão inválida ou expirada"))
        headers = {**PRIVATE_HEADERS, "WWW-Authenticate": "Bearer"} if code == 401 else PRIVATE_HEADERS
        raise HTTPException(code, detail, headers=headers) from None
    response.headers.update(PRIVATE_HEADERS)
    return {"authorization_url": authorization_url}


@router.get("/password/authorize")
def authorize_google_password(request: Request, db: Db):
    if not enabled():
        return return_to_frontend(google_password_error="disabled")
    ticket = request.query_params.get("ticket")
    if not google.is_secret(ticket):
        return return_to_frontend(google_password_error="invalid")
    browser = request.cookies.get(google_password.COOKIE)
    if not google.is_secret(browser):
        browser = google.new_secret()
    location = google_password.authorize(db, ticket=ticket, browser_secret=browser)
    if location is None:
        return return_to_frontend(google_password_error="invalid")
    response = RedirectResponse(location, status_code=303, headers=PRIVATE_HEADERS)
    callback = urlsplit(settings.google_redirect_uri)
    response.set_cookie(google_password.COOKIE, browser, max_age=google.ATTEMPT_TTL,
                        path=callback.path.rsplit("/", 1)[0], httponly=True,
                        secure=callback.scheme == "https", samesite="lax")
    return response


def google_password_callback(request: Request, db: Session, state: str):
    if not enabled():
        return return_to_frontend(google_password_error="disabled")
    browser = request.cookies.get(google_password.COOKIE)
    if not (google.is_secret(state) and google.is_secret(browser)):
        return return_to_frontend(google_password_error="invalid")
    claimed = google_password.claim_callback(db, state=state, browser_secret=browser)
    if claimed is None:
        return return_to_frontend(google_password_error="invalid")
    if request.query_params.get("error"):
        error = request.query_params["error"]
        if error in {"login_required", "interaction_required", "consent_required"}:
            return return_to_frontend(google_password_error="reauth_required")
        return return_to_frontend(google_password_error="cancelled" if error == "access_denied" else "failed")
    code = request.query_params.get("code")
    if not code or len(code) > 2048:
        return return_to_frontend(google_password_error="invalid")
    attempt, subject = claimed
    try:
        proof = google_password.issue_proof(db, code=code, attempt=attempt, subject=subject)
    except google.InvalidGoogleIdentity:
        return return_to_frontend(google_password_error="failed")
    except google_password.PasswordFlowError as exc:
        return return_to_frontend(google_password_error=exc.code)
    return return_to_frontend(google_password_code=proof)


@router.get("/callback")
def google_callback(request: Request, db: Db):
    state = request.query_params.get("state")
    if state and state.startswith(google_password.STATE_PREFIX):
        return google_password_callback(request, db, state.removeprefix(google_password.STATE_PREFIX))
    if not enabled():
        return return_to_frontend(google_error="disabled")
    browser = request.cookies.get(COOKIE)
    if not (google.is_secret(state) and google.is_secret(browser)):
        return return_to_frontend(google_error="invalid")
    attempt = google.consume_attempt(db, state, browser)
    if attempt is None:
        return return_to_frontend(google_error="invalid")
    if request.query_params.get("error"):
        return return_to_frontend(google_error="cancelled")
    code = request.query_params.get("code")
    if not code or len(code) > 2048:
        return return_to_frontend(google_error="invalid")
    try:
        subject, email = google.verify_google_code(code, attempt.google_verifier, attempt.nonce)
        grant = google.issue_grant(db, subject, email, attempt.frontend_challenge)
    except google.InvalidGoogleIdentity:
        return return_to_frontend(google_error="failed")
    except google.GoogleEmailConflict:
        return return_to_frontend(google_error="email_conflict")
    return return_to_frontend(google_code=grant)


@router.post("/exchange", response_model=TokenResponse)
def exchange_google_grant(body: GoogleExchangeRequest, response: Response, db: Db):
    if not enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Login Google desativado", headers=PRIVATE_HEADERS)
    grant = google.consume_grant(db, body.code, body.verifier)
    if grant is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Autorização Google inválida ou expirada", headers=PRIVATE_HEADERS)
    user_id, version = grant
    response.headers.update(PRIVATE_HEADERS)
    return {"access_token": create_access_token(str(user_id), session_version=version), "token_type": "bearer"}
