"""Add a permanent marker for the first administrator setup.

Revision ID: 20261124_09
Revises: 20261124_08
"""
import sqlalchemy as sa
from alembic import op

revision = "20261124_09"
down_revision = "20261124_08"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "first_admin_setup",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_first_admin_setup_singleton"),
    )
    # Existing installations with an administrator have already initialized the role.
    op.execute(sa.text("""
        INSERT INTO first_admin_setup (id, closed_at)
        SELECT 1, CURRENT_TIMESTAMP
        WHERE EXISTS (SELECT 1 FROM users WHERE is_superuser = 1)
    """))


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT 1 FROM first_admin_setup WHERE id = 1")):
        raise RuntimeError("O downgrade apagaria o registro de uso da configuração inicial. Revogue o código antigo e planeje a reversão explicitamente.")
    op.drop_table("first_admin_setup")
