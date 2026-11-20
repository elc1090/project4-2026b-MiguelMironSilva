"""Add an independent watchlist flag to user movie states.

Revision ID: 20261119_06
Revises: 20261118_05
"""
import sqlalchemy as sa
from alembic import op

revision = "20261119_06"
down_revision = "20261118_05"
branch_labels = None
depends_on = None


def upgrade():
    # Add the column in place: no table rebuild or changes to existing references.
    op.add_column(
        "user_movies",
        sa.Column("watchlist", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column("user_movies", "watchlist")
