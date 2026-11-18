"""Adiciona avaliações de filmes dos usuários.

Revision ID: 20261117_02
Revises: 20261117_01
"""
from alembic import op
import sqlalchemy as sa

revision = "20261117_02"
down_revision = "20261117_01"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tmdb_id", sa.BigInteger(), nullable=False),
        sa.Column("text", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "tmdb_id", name="uq_reviews_user_movie"),
        sqlite_autoincrement=True,
    )
    op.create_index("ix_reviews_tmdb_id", "reviews", ["tmdb_id"])


def downgrade():
    op.drop_index("ix_reviews_tmdb_id", table_name="reviews")
    op.drop_table("reviews")
