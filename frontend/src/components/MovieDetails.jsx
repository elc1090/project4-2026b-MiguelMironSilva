import { useEffect, useState } from "react";

import {
getMovie,
getMovieCredits,
} from "../services/api.js";

import CastList from "./CastList.jsx";
import MovieControls from "./MovieControls.jsx";
import MovieReviews from "./MovieReviews.jsx";

const IMAGE_BASE_URL =
"https://image.tmdb.org/t/p/w500";

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


if (!Number.isFinite(numericRating)) {
    return null;
}

const amount = Math.max(
    0,
    Math.min(
        10,
        Math.floor(numericRating)
    )
);

return Array.from(
    { length: amount },
    (_, index) => (
        <i
            key={index}
            className="fa-solid fa-star"
            aria-hidden="true"
        />
    )
);


};

function MovieDetails({
movie,
currentUser,
onLogin,
onBack,
}) {
const movieId = movie?.id;
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


const posterUrl = movieDetails?.poster_path
    ? `${IMAGE_BASE_URL}${movieDetails.poster_path}`
    : "/images/gray background.jpg";


const releaseYear = movieDetails?.release_date
    ? movieDetails.release_date.substring(0, 4)
    : "";


const genres = Array.isArray(
    movieDetails?.genres
)
    ? movieDetails.genres.slice(0, 5)
    : [];


const tmdbRating = Number(
    movieDetails?.vote_average
);


return (
    <section className="movie-container">

        <button
            type="button"
            className="movie-back-btn"
            onClick={onBack}
        >
            Voltar
        </button>

        {isLoading && <p role="status">Carregando filme...</p>}
        {error && <p className="search-error" role="alert">{error}</p>}

        {movieDetails && <div className="movie-details-container">

            <div className="movie-image">

                <img
                    src={posterUrl}
                    alt={`${movieDetails.title} Poster`}
                />

            </div>


            <div className="movie-details">

                <div className="movie-heading">
                    <h1>
                        {movieDetails.title}
                        {releaseYear && (
                            ` (${releaseYear})`
                        )}
                    </h1>
                </div>


                <p className="movie-original-name">
                    Título Original:
                    {" "}
                    <span>
                        {movieDetails.original_title}
                    </span>
                </p>


                <div className="genres">

                    <p>Gêneros:</p>

                    <ul className="genres-list">

                        {genres.map((genre) => (
                            <li key={genre.id}>
                                {genre.name}
                            </li>
                        ))}

                    </ul>

                </div>


                <p className="ratings">

                    <span>
                        Nota do TMDB:
                    </span>

                    <span>
                        {Number.isFinite(tmdbRating)
                            ? tmdbRating.toFixed(1)
                            : "N/A"}
                    </span>

                    <span
                        className="rating-stars"
                        aria-label={
                            Number.isFinite(tmdbRating)
                                ? `${Math.floor(tmdbRating)} de 10 estrelas`
                                : "Sem avaliação"
                        }
                    >
                        {renderExternalRatingStars(
                            tmdbRating
                        )}
                    </span>

                </p>


                <p className="description">
                    {movieDetails.overview ||
                        "Descrição não informada."}
                </p>


                <p className="adult-content">
                    Conteúdo Adulto:
                    {" "}
                    <span>
                        {movieDetails.adult
                            ? "Sim"
                            : "Não"}
                    </span>
                </p>


                <p className="original-language">
                    Linguagem Original:
                    {" "}
                    <span>
                        {getLanguageName(
                            movieDetails.original_language
                        )}
                    </span>
                </p>


                <MovieControls
                    movie={movieDetails}
                    currentUser={currentUser}
                />

            </div>

        </div>}

        <MovieReviews
            movieId={movieId}
            currentUser={currentUser}
            onLogin={onLogin}
        />

        {creditsError ? <p>Não foi possível carregar o elenco.</p> : <CastList cast={credits} />}

    </section>
);


}

export default MovieDetails;
