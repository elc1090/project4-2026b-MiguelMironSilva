"""Persist Google identities and transient login credentials.

Revision ID: 20261123_07
Revises: 20261119_06
"""
import sqlalchemy as sa
from alembic import op

revision = "20261123_07"
down_revision = "20261119_06"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "google_identities",
        sa.Column("subject", sa.String(255), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
    )
    op.create_table(
        "google_login_attempts",
        sa.Column("state_hash", sa.String(64), primary_key=True),
        sa.Column("browser_hash", sa.String(64), nullable=False),
        sa.Column("frontend_challenge", sa.String(43), nullable=False),
        sa.Column("nonce", sa.String(43), nullable=False),
        sa.Column("google_verifier", sa.String(43), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )
    op.create_index("ix_google_login_attempts_expires_at", "google_login_attempts", ["expires_at"])
    op.create_table(
        "google_login_grants",
        sa.Column("code_hash", sa.String(64), primary_key=True),
        sa.Column("challenge", sa.String(43), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )
    op.create_index("ix_google_login_grants_expires_at", "google_login_grants", ["expires_at"])


def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM google_identities LIMIT 1")).scalar():
        raise RuntimeError("Reverter a migração removeria identidades de contas Google existentes; restaure um backup.")
    op.drop_table("google_login_grants")
    op.drop_table("google_login_attempts")
    op.drop_table("google_identities")
