import { useEffect, useState } from "react";

import {
getMovieState,
updateMovieState,
} from "../services/api.js";

const EMPTY_STATE = {
favorite: false,
watched: false,
};

function MovieControls({
movie,
currentUser,
}) {
const [movieState, setMovieState] = useState(
EMPTY_STATE
);

const [isLoading, setIsLoading] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState("");


useEffect(() => {
    let cancelled = false;


    const loadState = async () => {
        if (!movie?.id || !currentUser) {
            setMovieState(EMPTY_STATE);
            setError("");
            return;
        }


        setIsLoading(true);
        setError("");


        try {
            const state = await getMovieState(
                movie.id
            );


            if (cancelled) {
                return;
            }


            setMovieState({
                favorite: Boolean(state.favorite),
                watched: Boolean(state.watched),
            });

        } catch (loadError) {
            if (cancelled) {
                return;
            }


            console.error(
                "Failed to load movie state:",
                loadError
            );


            setMovieState(EMPTY_STATE);

            setError(
                loadError.message ||
                "Falha ao carregar o estado do filme."
            );

        } finally {
            if (!cancelled) {
                setIsLoading(false);
            }
        }
    };


    loadState();


    return () => {
        cancelled = true;
    };
}, [movie, currentUser]);


const saveState = async (changes) => {
    if (!currentUser || !movie?.id) {
        return;
    }


    setIsSaving(true);
    setError("");


    try {
        const updatedState =
            await updateMovieState(
                movie.id,
                changes
            );


        setMovieState({
            favorite: Boolean(updatedState.favorite),
            watched: Boolean(updatedState.watched),
        });

    } catch (saveError) {
        console.error(
            "Failed to save movie state:",
            saveError
        );

        setError(
            saveError.message ||
            "Falha ao salvar a alteração."
        );

    } finally {
        setIsSaving(false);
    }
};


const toggleFavorite = () => {
    saveState({
        favorite: !movieState.favorite,
    });
};


const toggleWatched = () => {
    saveState({
        watched: !movieState.watched,
    });
};


const controlsDisabled =
    !currentUser ||
    isLoading ||
    isSaving;


return (
    <div className="user-movie-controls">

        <button
            type="button"
            onClick={toggleFavorite}
            disabled={controlsDisabled}
            aria-pressed={movieState.favorite}
        >
            {movieState.favorite
                ? "Favoritado"
                : "Favoritar"}
        </button>


        <button
            type="button"
            onClick={toggleWatched}
            disabled={controlsDisabled}
            aria-pressed={movieState.watched}
        >
            {movieState.watched
                ? "Assistido"
                : "Marcar como assistido"}
        </button>


        {isLoading && (
            <span className="movie-controls-status">
                Carregando...
            </span>
        )}


        {isSaving && (
            <span className="movie-controls-status">
                Salvando...
            </span>
        )}


        {error && (
            <span className="movie-controls-error">
                {error}
            </span>
        )}

    </div>
);

}

export default MovieControls;
