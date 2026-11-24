import { useId } from "react";
import { getMyReviews, getToken } from "../services/api.js";
import { ReviewDate } from "./MovieReviews.jsx";
import { usePersonalMovieList } from "./usePersonalMovieList.js";

function ReviewsForSession({ token, onMovieSelected }) {
    const { rows, error, movieFor } = usePersonalMovieList(getMyReviews, token);

    if (error) return (
        <p className="panel-empty" role="alert">
            {error.status === 401
                ? "Sua sessão expirou. Entre novamente para ver suas avaliações."
                : "Não foi possível carregar suas avaliações. Tente novamente."}
        </p>
    );
    if (!rows) return <p className="panel-empty" role="status">Carregando suas avaliações...</p>;
    if (rows.length === 0) return <p className="panel-empty">Você ainda não publicou nenhuma avaliação.</p>;

    return (
        <ul className="my-review-list">
            {rows.map(review => {
                const movie = movieFor(review.tmdb_id);
                return (
                    <li key={review.id}>
                        <article>
                            <div className="my-review-header">
                                <div>
                                    <h2>{movie.title}</h2>
                                    <p className="my-review-dates">
                                        Publicada em <ReviewDate value={review.created_at} />
                                        {review.updated_at && (
                                            <> · Editada em <ReviewDate value={review.updated_at} /></>
                                        )}
                                    </p>
                                </div>
                                {review.rating != null && <p className="my-review-rating">Nota: {review.rating}/10</p>}
                            </div>
                            {review.text != null && <p className="my-review-text">{review.text}</p>}
                            <button type="button" className="button-secondary my-review-open-movie"
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
        <main className="page-shell panel-page my-reviews-section" id="main-content" tabIndex={-1} aria-labelledby={titleId}>
            <div className="panel-page-header">
                <div>
                    <p className="eyebrow">Minha coleção / Resenhas</p>
                    <h1 id={titleId}>Minhas avaliações</h1>
                    <p className="panel-intro">Relembre as notas e resenhas que você publicou.</p>
                </div>
                <button className="button-secondary panel-back" type="button" onClick={onBack}>
                    <span aria-hidden="true" />Pesquisar
                </button>
            </div>
            {currentUser ? (
                <ReviewsForSession key={JSON.stringify([currentUser.id, token])}
                    token={token} onMovieSelected={onMovieSelected} />
            ) : <p className="panel-empty">Entre para ver suas avaliações.</p>}
        </main>
    );
}
