from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user_movie import UserMovie


def get_movie_state(
    db: Session,
    user_id: int,
    tmdb_id: str,
):
    return db.scalar(
        select(UserMovie).where(
            UserMovie.user_id == user_id,
            UserMovie.tmdb_id == tmdb_id,
        )
    )


def get_all_movie_states(
    db: Session,
    user_id: int,
):
    return db.scalars(
        select(UserMovie).where(
            UserMovie.user_id == user_id,
        )
    ).all()


def update_movie_state(
    db: Session,
    user_id: int,
    tmdb_id: str,
    updates: dict,
):
    movie_state = get_movie_state(
        db,
        user_id,
        tmdb_id,
    )

    is_new = movie_state is None
    if is_new:
        movie_state = UserMovie(
            user_id=user_id,
            tmdb_id=tmdb_id,
            favorite=False,
            watched=False,
            watchlist=False,
        )

    for field, value in updates.items():
        setattr(movie_state, field, value)

    # Mantenha o registro somente enquanto ao menos uma sinalização independente estiver ativa.
    if not (movie_state.favorite or movie_state.watched or movie_state.watchlist):
        if not is_new:
            db.delete(movie_state)
            db.commit()
        return {
            "tmdb_id": tmdb_id,
            "favorite": False,
            "watched": False,
            "watchlist": False,
        }

    if is_new:
        db.add(movie_state)
    db.commit()
    db.refresh(movie_state)

    return movie_state


def delete_movie_state(
    db: Session,
    user_id: int,
    tmdb_id: str,
):
    movie_state = get_movie_state(
        db,
        user_id,
        tmdb_id,
    )

    if movie_state is None:
        return False

    db.delete(movie_state)
    db.commit()

    return True