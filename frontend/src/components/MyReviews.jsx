import { useId } from "react";
import { getMyReviews, getToken } from "../services/api.js";
import { ReviewDate } from "./MovieReviews.jsx";
import { usePersonalMovieList } from "./usePersonalMovieList.js";

function ReviewsForSession({ token, onMovieSelected }) {
    const { rows, error, movieFor } = usePersonalMovieList(getMyReviews, token);

    if (error) return (
        <p className="search-error" role="alert">
            {error.status === 401
                ? "Sua sessão expirou. Entre novamente para ver suas avaliações."
                : "Não foi possível carregar suas avaliações. Tente novamente."}
        </p>
    );
    if (!rows) return <p role="status">Carregando suas avaliações...</p>;
    if (rows.length === 0) return <p>Você ainda não publicou nenhuma avaliação.</p>;

    return (
        <ul className="movie-review-list">
            {rows.map(review => {
                const movie = movieFor(review.tmdb_id);
                return (
                    <li key={review.id}>
                        <article>
                            <h2>{movie.title}</h2>
                            {review.rating != null && <p>Nota: {review.rating}/10</p>}
                            <p className="movie-review-dates">
                                Publicada em <ReviewDate value={review.created_at} />
                                {review.updated_at && (
                                    <> · Editada em <ReviewDate value={review.updated_at} /></>
                                )}
                            </p>
                            {review.text != null && <p className="movie-review-text">{review.text}</p>}
                            <button type="button" className="my-review-open-movie"
                                aria-label={`Ver detalhes do filme: ${movie.title}`}
                                onClick={() => onMovieSelected(movie)}>
                                Ver detalhes do filme
                            </button>
                        </article>
                    </li>
                );
            })}
        </ul>
    );
}

export default function MyReviews({ currentUser, onMovieSelected, onBack }) {
    const titleId = useId();
    const token = currentUser ? getToken() : null;
    return (
        <section className="my-movies-section my-reviews-section" aria-labelledby={titleId}>
            <div className="my-movies-header">
                <h1 id={titleId}>Minhas avaliações</h1>
                <button type="button" onClick={onBack}>Pesquisar</button>
            </div>
            {currentUser ? (
                <ReviewsForSession key={JSON.stringify([currentUser.id, token])}
                    token={token} onMovieSelected={onMovieSelected} />
            ) : <p>Entre para ver suas avaliações.</p>}
        </section>
    );
}
