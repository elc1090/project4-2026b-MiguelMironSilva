"""Adiciona um indicador independente de lista para assistir aos estados de filmes.

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
    # Adicione a coluna no local, sem reconstruir a tabela nem alterar referências existentes.
    op.add_column(
        "user_movies",
        sa.Column("watchlist", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column("user_movies", "watchlist")
