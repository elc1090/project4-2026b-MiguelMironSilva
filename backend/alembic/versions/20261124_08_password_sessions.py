"""Support password rotation and single-use Google step-up proofs.

Revision ID: 20261124_08
Revises: 20261123_07
"""
import sqlalchemy as sa
from alembic import op

revision = "20261124_08"
down_revision = "20261123_07"
branch_labels = None
depends_on = None


def _scope_columns():
    return (
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_version", sa.Integer(), nullable=False),
        sa.Column("session_digest", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )


def upgrade():
    # SQLite ADD COLUMN leaves the users AUTOINCREMENT constraint untouched.
    op.add_column("users", sa.Column("session_version", sa.Integer(), server_default="0", nullable=False))
    op.create_table(
        "google_password_attempts",
        sa.Column("ticket_hash", sa.String(64), primary_key=True),
        sa.Column("browser_hash", sa.String(64), nullable=True),
        sa.Column("frontend_challenge", sa.String(43), nullable=False),
        sa.Column("nonce", sa.String(43), nullable=False),
        sa.Column("google_verifier", sa.String(43), nullable=False),
        sa.Column("started_at", sa.Integer(), nullable=False),
        *_scope_columns(),
    )
    op.create_index("ix_google_password_attempts_expires_at", "google_password_attempts", ["expires_at"])
    op.create_table(
        "google_password_proofs",
        sa.Column("code_hash", sa.String(64), primary_key=True),
        sa.Column("challenge", sa.String(43), nullable=False),
        *_scope_columns(),
    )
    op.create_index("ix_google_password_proofs_expires_at", "google_password_proofs", ["expires_at"])


def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM users WHERE session_version <> 0 LIMIT 1")).scalar():
        raise RuntimeError("O downgrade poderia revalidar sessões antigas após uma troca de senha. Use um plano de reversão com rotação da chave JWT.")
    op.drop_table("google_password_proofs")
    op.drop_table("google_password_attempts")
    op.drop_column("users", "session_version")
