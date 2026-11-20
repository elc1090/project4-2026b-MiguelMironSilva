from datetime import datetime, timezone
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models.review import Review
from app.models.user import User
from app.schemas.reviews import ReviewResponse, ReviewWrite


router = APIRouter(prefix="/api/movies/{tmdb_id}/reviews", tags=["reviews"])
personal_router = APIRouter(prefix="/api/reviews", tags=["reviews"])

SQLiteId = Annotated[int, Path(ge=1, le=2**63 - 1)]
Database = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _find_review(db: Session, tmdb_id: int, review_id: int) -> Review:
    review = db.scalar(select(Review).where(Review.id == review_id, Review.tmdb_id == tmdb_id))
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resenha não encontrada")
    return review


@router.get("", response_model=list[ReviewResponse])
def list_reviews(tmdb_id: SQLiteId, db: Database):
    return db.scalars(
        select(Review)
        .options(joinedload(Review.author))
        .where(Review.tmdb_id == tmdb_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
    ).all()


@personal_router.get("/mine", response_model=list[ReviewResponse])
def list_my_reviews(db: Database, current_user: CurrentUser):
    return db.scalars(
        select(Review)
        .options(joinedload(Review.author))
        .where(Review.user_id == current_user.id)
        .order_by(Review.created_at.desc(), Review.id.desc())
    ).all()


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(tmdb_id: SQLiteId, data: ReviewWrite, db: Database, current_user: CurrentUser):
    if data.text is None and data.rating is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Informe uma nota ou escreva uma resenha")
    review = Review(tmdb_id=tmdb_id, text=data.text, rating=data.rating, author=current_user)
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Translate only this pair's unique violation, including concurrent inserts.
        if (
            isinstance(exc.orig, sqlite3.IntegrityError)
            and getattr(exc.orig, "sqlite_errorcode", None) == sqlite3.SQLITE_CONSTRAINT_UNIQUE
            and str(exc.orig) == "UNIQUE constraint failed: reviews.user_id, reviews.tmdb_id"
        ):
            raise HTTPException(status.HTTP_409_CONFLICT, "Você já escreveu uma resenha para este filme") from exc
        raise
    return review


@router.patch("/{review_id}", response_model=ReviewResponse)
def update_review(
    tmdb_id: SQLiteId, review_id: SQLiteId, data: ReviewWrite, db: Database, current_user: CurrentUser
):
    review = _find_review(db, tmdb_id, review_id)
    if review.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Apenas o autor pode editar esta resenha")
    if not data.model_fields_set:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Informe a nota e/ou o texto a atualizar")
    new_text = data.text if "text" in data.model_fields_set else review.text
    new_rating = data.rating if "rating" in data.model_fields_set else review.rating
    if new_text is None and new_rating is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Uma avaliação precisa conter nota ou texto")
    review.text = new_text
    review.rating = new_rating
    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    return review


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(tmdb_id: SQLiteId, review_id: SQLiteId, db: Database, current_user: CurrentUser):
    """Remove a resenha (nota e texto) como autor ou superusuário."""
    review = _find_review(db, tmdb_id, review_id)
    if review.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Apenas o autor ou um superusuário pode excluir esta resenha")
    db.delete(review)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
