"""Move personal film ratings into public reviews.

Revision ID: 20261117_03
Revises: 20261117_02
"""
from alembic import op
import sqlalchemy as sa

revision = "20261117_03"
down_revision = "20261117_02"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("reviews") as batch:
        batch.alter_column("text", existing_type=sa.String(length=2000), nullable=True)
        batch.add_column(sa.Column("rating", sa.Integer(), nullable=True))
        batch.create_check_constraint(
            "ck_reviews_rating_range", "rating IS NULL OR (rating >= 0 AND rating <= 10)"
        )
        batch.create_check_constraint(
            "ck_reviews_content_present", "text IS NOT NULL OR rating IS NOT NULL"
        )

    # Preserve legacy ratings; merge into an existing public review where present,
    # otherwise create a rating-only review for this author and film.
    op.execute(sa.text("""
        UPDATE reviews
        SET rating = (
            SELECT user_movies.rating
            FROM user_movies
            WHERE user_movies.user_id = reviews.user_id
              AND CAST(user_movies.tmdb_id AS INTEGER) = reviews.tmdb_id
        )
        WHERE EXISTS (
            SELECT 1 FROM user_movies
            WHERE user_movies.user_id = reviews.user_id
              AND CAST(user_movies.tmdb_id AS INTEGER) = reviews.tmdb_id
              AND user_movies.rating IS NOT NULL
        )
    """))
    op.execute(sa.text("""
        INSERT INTO reviews (user_id, tmdb_id, text, rating, created_at, updated_at)
        SELECT user_movies.user_id, CAST(user_movies.tmdb_id AS INTEGER), NULL,
               user_movies.rating, CURRENT_TIMESTAMP, NULL
        FROM user_movies
        WHERE user_movies.rating IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM reviews
              WHERE reviews.user_id = user_movies.user_id
                AND reviews.tmdb_id = CAST(user_movies.tmdb_id AS INTEGER)
          )
    """))

    with op.batch_alter_table("user_movies") as batch:
        batch.drop_column("rating")


def downgrade():
    with op.batch_alter_table("user_movies") as batch:
        batch.add_column(sa.Column("rating", sa.Integer(), nullable=True))

    # Restore ratings to the old personal-state structure. If needed, create a
    # minimal state row so rating-only reviews survive this downgrade.
    op.execute(sa.text("""
        UPDATE user_movies
        SET rating = (
            SELECT reviews.rating FROM reviews
            WHERE reviews.user_id = user_movies.user_id
              AND reviews.tmdb_id = CAST(user_movies.tmdb_id AS INTEGER)
        )
        WHERE EXISTS (
            SELECT 1 FROM reviews
            WHERE reviews.user_id = user_movies.user_id
              AND reviews.tmdb_id = CAST(user_movies.tmdb_id AS INTEGER)
              AND reviews.rating IS NOT NULL
        )
    """))
    op.execute(sa.text("""
        INSERT INTO user_movies (user_id, tmdb_id, favorite, watched, rating)
        SELECT reviews.user_id, CAST(reviews.tmdb_id AS TEXT), 0, 0, reviews.rating
        FROM reviews
        WHERE reviews.rating IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM user_movies
              WHERE user_movies.user_id = reviews.user_id
                AND user_movies.tmdb_id = CAST(reviews.tmdb_id AS TEXT)
          )
    """))
    # A 20261117_02 review requires non-null text; restore ratings first and
    # drop rating-only review rows before returning to that schema.
    op.execute(sa.text("DELETE FROM reviews WHERE text IS NULL"))
    with op.batch_alter_table("reviews") as batch:
        batch.drop_constraint("ck_reviews_content_present", type_="check")
        batch.drop_constraint("ck_reviews_rating_range", type_="check")
        batch.drop_column("rating")
        batch.alter_column("text", existing_type=sa.String(length=2000), nullable=False)
