"""Reautenticação Google para definir a primeira senha de uma conta vinculada."""

import time
from urllib.parse import urlencode, urlsplit

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.google_login import GoogleIdentity, GooglePasswordAttempt, GooglePasswordProof
from app.models.user import User
from app.services import google_login as google


STATE_PREFIX = "p."
COOKIE = "google_password_browser"
TICKET_TTL = 60
PROOF_TTL = 60
AUTH_CLOCK_SKEW = 3


class PasswordFlowError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _account(db: Session, user_id: int):
    return db.execute(
        select(User.session_version, User.password_hash, GoogleIdentity.subject)
        .outerjoin(GoogleIdentity, GoogleIdentity.user_id == User.id)
        .where(User.id == user_id)
    ).one_or_none()


def start(db: Session, *, user_id: int, session_version: int, session_digest: str, challenge: str) -> str:
    ticket = google.new_secret()
    # Encerre a transação de leitura da autenticação antes de obter o bloqueio de escrita.
    db.rollback()
    with db.begin():
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        account = _account(db, user_id)
        if account is None or account.session_version != session_version:
            raise PasswordFlowError("invalid")
        if account.subject is None:
            raise PasswordFlowError("not_linked")
        if account.password_hash:
            raise PasswordFlowError("already_password")
        now = int(time.time())
        db.execute(delete(GooglePasswordAttempt).where(GooglePasswordAttempt.expires_at <= now))
        db.execute(delete(GooglePasswordProof).where(GooglePasswordProof.expires_at <= now))
        db.add(GooglePasswordAttempt(
            ticket_hash=google.digest(ticket), browser_hash=None, frontend_challenge=challenge,
            nonce=google.new_secret(), google_verifier=google.new_secret(),
            started_at=now, expires_at=now + TICKET_TTL,
            user_id=user_id, session_version=session_version, session_digest=session_digest,
        ))
    callback = urlsplit(settings.google_redirect_uri)
    path = callback.path.removesuffix("/callback") + "/password/authorize"
    return callback._replace(path=path, query=urlencode({"ticket": ticket})).geturl()


def authorize(db: Session, *, ticket: str, browser_secret: str) -> str | None:
    state = google.new_secret()
    now = int(time.time())
    attempt = db.execute(update(GooglePasswordAttempt).where(
        GooglePasswordAttempt.ticket_hash == google.digest(ticket),
        GooglePasswordAttempt.browser_hash.is_(None),
        GooglePasswordAttempt.expires_at > now,
    ).values(
        # Alterne o identificador: o tíquete de navegação não pode ser reutilizado
        # como estado do provedor, e a tentativa pendente fica vinculada ao navegador.
        ticket_hash=google.digest(state), browser_hash=google.digest(browser_secret),
        started_at=now, expires_at=now + google.ATTEMPT_TTL,
    ).returning(
        GooglePasswordAttempt.user_id, GooglePasswordAttempt.session_version,
        GooglePasswordAttempt.nonce, GooglePasswordAttempt.google_verifier,
    )).one_or_none()
    if attempt is not None:
        account = _account(db, attempt.user_id)
        if (account is None or account.session_version != attempt.session_version
                or account.password_hash or account.subject is None):
            attempt = None
    db.commit()
    if attempt is None:
        return None
    return google.authorization_url(
        STATE_PREFIX + state, attempt.nonce, attempt.google_verifier, require_auth_time=True,
    )


def claim_callback(db: Session, *, state: str, browser_secret: str):
    attempt = db.execute(delete(GooglePasswordAttempt).where(
        GooglePasswordAttempt.ticket_hash == google.digest(state),
        GooglePasswordAttempt.browser_hash == google.digest(browser_secret),
        GooglePasswordAttempt.expires_at > int(time.time()),
    ).returning(
        GooglePasswordAttempt.user_id, GooglePasswordAttempt.session_version,
        GooglePasswordAttempt.session_digest, GooglePasswordAttempt.frontend_challenge,
        GooglePasswordAttempt.nonce, GooglePasswordAttempt.google_verifier,
        GooglePasswordAttempt.started_at,
    )).one_or_none()
    account = _account(db, attempt.user_id) if attempt is not None else None
    db.commit()
    if (attempt is None or account is None or account.session_version != attempt.session_version
            or account.password_hash or account.subject is None):
        return None
    return attempt, account.subject


def issue_proof(db: Session, *, code: str, attempt, subject: str) -> str:
    claims = google.verified_google_claims(code, attempt.google_verifier, attempt.nonce)
    auth_time = claims.get("auth_time")
    now = int(time.time())
    if (type(auth_time) is not int
            or not attempt.started_at - AUTH_CLOCK_SKEW <= auth_time <= now + AUTH_CLOCK_SKEW):
        raise PasswordFlowError("reauth_required")
    if claims["sub"] != subject:
        raise PasswordFlowError("wrong_account")

    proof = google.new_secret()
    with db.begin():
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        account = _account(db, attempt.user_id)
        # Uma troca de senha ou exclusão de conta pode ter sido confirmada enquanto
        # a aplicação aguardava o Google; nunca emita uma prova para um estado obsoleto.
        if (account is None or account.session_version != attempt.session_version
                or account.password_hash or account.subject != subject):
            raise PasswordFlowError("invalid")
        db.add(GooglePasswordProof(
            code_hash=google.digest(proof), challenge=attempt.frontend_challenge,
            user_id=attempt.user_id, session_version=attempt.session_version,
            session_digest=attempt.session_digest, expires_at=int(time.time()) + PROOF_TTL,
        ))
    return proof


def consume_proof(db: Session, *, code: str, verifier: str, user_id: int,
                  session_version: int, session_digest: str) -> bool:
    """Use uma vez na transação de gravação de senha chamadora; não confirme aqui."""
    if not (google.is_secret(code) and google.is_secret(verifier)):
        return False
    return db.execute(delete(GooglePasswordProof).where(
        GooglePasswordProof.code_hash == google.digest(code),
        GooglePasswordProof.challenge == google.challenge_for(verifier),
        GooglePasswordProof.user_id == user_id,
        GooglePasswordProof.session_version == session_version,
        GooglePasswordProof.session_digest == session_digest,
        GooglePasswordProof.expires_at > int(time.time()),
    ).returning(GooglePasswordProof.user_id)).scalar_one_or_none() is not None
