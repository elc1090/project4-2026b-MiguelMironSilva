from typing import Annotated
from urllib.parse import urlencode, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.auth import GoogleExchangeRequest, TokenResponse
from app.services import google_login as google
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


@router.get("/callback")
def google_callback(request: Request, db: Db):
    if not enabled():
        return return_to_frontend(google_error="disabled")
    state = request.query_params.get("state")
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
    user_id = google.consume_grant(db, body.code, body.verifier)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Autorização Google inválida ou expirada", headers=PRIVATE_HEADERS)
    response.headers.update(PRIVATE_HEADERS)
    return {"access_token": create_access_token(str(user_id)), "token_type": "bearer"}
