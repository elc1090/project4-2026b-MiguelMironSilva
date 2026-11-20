import { useEffect, useRef, useState } from "react";
import { getMovieState, getToken, updateMovieState } from "../services/api.js";

function ControlsForSession({ movieId, token }) {
    const [state, setState] = useState(null);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const activeWrite = useRef(null);

    useEffect(() => {
        if (!token || movieId == null || getToken() !== token) return;

        const controller = new AbortController();
        const { signal } = controller;
        const isCurrent = () => !signal.aborted && getToken() === token;
        getMovieState(movieId, { signal }).then(movieState => {
            if (isCurrent()) setState(movieState);
        }).catch(loadError => {
            if (isCurrent()) {
                setError(loadError.status === 401
                    ? "Sua sessão expirou. Entre novamente para atualizar seus filmes."
                    : "Não foi possível carregar o estado do filme.");
            }
        });

        return () => controller.abort();
    }, [movieId, token]);

    useEffect(() => () => activeWrite.current?.abort(), []);

    async function toggle(field) {
        if (!token || movieId == null || getToken() !== token || !state || activeWrite.current) return;
        const controller = new AbortController();
        const { signal } = controller;
        activeWrite.current = controller;
        const isCurrent = () => !signal.aborted && activeWrite.current === controller && getToken() === token;
        setIsSaving(true);
        setError("");

        try {
            const updated = await updateMovieState(movieId, { [field]: !state[field] }, { signal });
            if (isCurrent()) setState(updated);
        } catch (saveError) {
            if (isCurrent()) {
                if (saveError.status === 401) setState(null);
                setError(saveError.status === 401
                    ? "Sua sessão expirou. Entre novamente para atualizar seus filmes."
                    : "Não foi possível salvar a alteração.");
            }
        } finally {
            if (isCurrent()) setIsSaving(false);
            if (activeWrite.current === controller) activeWrite.current = null;
        }
    }

    const controlsDisabled = !state || isSaving;
    const isLoading = token && movieId != null && !state && !error;
    return (
        <div className="user-movie-controls">
            <button type="button" onClick={() => toggle("favorite")} disabled={controlsDisabled}
                aria-pressed={Boolean(state?.favorite)}>
                {state?.favorite ? "Favoritado" : "Favoritar"}
            </button>
            <button type="button" onClick={() => toggle("watched")} disabled={controlsDisabled}
                aria-pressed={Boolean(state?.watched)}>
                {state?.watched ? "Assistido" : "Marcar como assistido"}
            </button>
            <button type="button" onClick={() => toggle("watchlist")} disabled={controlsDisabled}
                aria-pressed={Boolean(state?.watchlist)}>
                Desejo assistir
            </button>
            {(isLoading || isSaving) && (
                <span className="movie-controls-status" role="status">{isSaving ? "Salvando..." : "Carregando..."}</span>
            )}
            {error && <span className="movie-controls-error" role="alert">{error}</span>}
        </div>
    );
}

export default function MovieControls({ movie, currentUser }) {
    const movieId = movie?.id;
    const token = currentUser ? getToken() : null;
    return <ControlsForSession key={JSON.stringify([movieId, currentUser?.id, token])}
        movieId={movieId} token={token} />;
}
