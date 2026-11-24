import { useEffect, useId, useState } from "react";
import { getMovie, getMovieCredits } from "../services/api.js";
import CastList from "./CastList.jsx";
import MovieControls from "./MovieControls.jsx";
import MovieReviews from "./MovieReviews.jsx";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

const getLanguageName = (language) => {
    const languages = {
        en: "Inglês",
        pt: "Português",
        es: "Espanhol",
        fr: "Francês",
        de: "Alemão",
        it: "Italiano",
        ja: "Japonês",
        ko: "Coreano",
        zh: "Chinês",
        ru: "Russo",
        hi: "Hindi",
    };

    return languages[language] || language || "Não informado";
};

const renderExternalRatingStars = (rating) => {
    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating)) return null;

    const amount = Math.max(0, Math.min(10, Math.floor(numericRating)));
    return Array.from({ length: amount }, (_, index) => (
        <span key={index} aria-hidden="true">★</span>
    ));
};

function MovieDetails({ movie, currentUser, onLogin, onBack }) {
    const movieId = movie?.id;
    const titleId = useId();
    const [movieDetails, setMovieDetails] = useState(null);
    const [credits, setCredits] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [creditsError, setCreditsError] = useState(false);

    useEffect(() => {
        if (!movieId) return;
        let cancelled = false;

        setIsLoading(true);
        setMovieDetails(null);
        setCredits([]);
        setError("");
        setCreditsError(false);

        getMovie(movieId)
            .then((details) => {
                if (!cancelled) setMovieDetails(details);
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setError(loadError.message || "Falha ao carregar os detalhes do filme.");
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        getMovieCredits(movieId)
            .then(({ cast }) => {
                if (!cancelled) setCredits(Array.isArray(cast) ? cast.slice(0, 10) : []);
            })
            .catch(() => {
                if (!cancelled) setCreditsError(true);
            });

        return () => {
            cancelled = true;
        };
    }, [movieId]);

    if (!movie) return null;

    const posterPath = movieDetails?.poster_path;
    const releaseYear = movieDetails?.release_date
        ? movieDetails.release_date.substring(0, 4)
        : "";
    const genres = Array.isArray(movieDetails?.genres) ? movieDetails.genres.slice(0, 5) : [];
    const tmdbRating = Number(movieDetails?.vote_average);
    const hasRating = Number.isFinite(tmdbRating);

    return (
        <main className="page-shell movie-detail-page" id="main-content" tabIndex={-1}>
            <div className="movie-detail-toolbar">
                <button type="button" className="button-secondary" onClick={onBack}>
                    Voltar
                </button>
            </div>

            {isLoading && <p className="movie-detail-status" role="status">Carregando filme...</p>}
            {error && <p className="movie-detail-status" role="alert">{error}</p>}

            {movieDetails && (
                <section className="movie-detail-hero" aria-labelledby={titleId}>
                    <header className="movie-detail-masthead">
                        <p className="eyebrow">Ficha do filme</p>
                        <h1 id={titleId}>
                            {movieDetails.title}
                            {releaseYear && <> <span className="movie-detail-year">({releaseYear})</span></>}
                        </h1>
                        <p className="movie-detail-original">
                            Título Original: <span>{movieDetails.original_title}</span>
                        </p>
                    </header>

                    <div className="movie-detail-poster">
                        {posterPath && (
                            <img
                                key={posterPath}
                                src={`${IMAGE_BASE_URL}${posterPath}`}
                                alt={`Cartaz de ${movieDetails.title}`}
                                onError={(event) => { event.currentTarget.hidden = true; }}
                            />
                        )}
                        <div className="movie-detail-poster-fallback">
                            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                                <rect x="4" y="4" width="24" height="24" rx="2" />
                                <path d="M10 4v24M22 4v24M4 12h6m12 0h6M4 20h6m12 0h6" />
                            </svg>
                            <span>Cartaz indisponível</span>
                        </div>
                    </div>

                    <div className="movie-detail-information">
                        {genres.length > 0 && (
                            <div className="movie-detail-genre-row">
                                <p>Gêneros:</p>
                                <ul className="movie-detail-genres">
                                    {genres.map((genre) => <li key={genre.id}>{genre.name}</li>)}
                                </ul>
                            </div>
                        )}
                        <p className="movie-detail-score">
                            <span>Nota do TMDB:</span>{" "}
                            <strong>{hasRating ? tmdbRating.toFixed(1) : "N/A"}</strong>
                            <span
                                className="movie-detail-stars"
                                role="img"
                                aria-label={hasRating ? `${Math.floor(tmdbRating)} de 10 estrelas` : "Sem avaliação"}
                            >
                                {renderExternalRatingStars(tmdbRating)}
                            </span>
                        </p>

                        <div className="movie-detail-synopsis">
                            <h2>Sinopse</h2>
                            <p>{movieDetails.overview || "Descrição não informada."}</p>
                        </div>

                        <dl className="movie-detail-facts">
                            <div>
                                <dt>Conteúdo Adulto:</dt>
                                <dd>{movieDetails.adult ? "Sim" : "Não"}</dd>
                            </div>
                            <div>
                                <dt>Linguagem Original:</dt>
                                <dd>{getLanguageName(movieDetails.original_language)}</dd>
                            </div>
                        </dl>

                        <MovieControls movie={movieDetails} currentUser={currentUser} />
                    </div>
                </section>
            )}

            <MovieReviews movieId={movieId} currentUser={currentUser} onLogin={onLogin} />

            {creditsError ? (
                <p className="movie-detail-status" role="status">Não foi possível carregar o elenco.</p>
            ) : <CastList cast={credits} />}
        </main>
    );
}

export default MovieDetails;
