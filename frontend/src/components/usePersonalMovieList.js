import { useEffect, useState } from "react";
import { getMovie, getToken } from "../services/api.js";

export function usePersonalMovieList(loadRows, token, { watchlistOnly = false } = {}) {
    const [rows, setRows] = useState(null);
    const [movies, setMovies] = useState(() => new Map());
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const isCurrent = () => !signal.aborted && getToken() === token;

        async function load() {
            if (!isCurrent()) return;
            if (!token) {
                setError({ status: 401 });
                return;
            }

            try {
                const data = await loadRows({ signal });
                if (!isCurrent()) return;
                if (!Array.isArray(data)) throw new Error("Lista de filmes inválida.");

                const visibleRows = watchlistOnly ? data.filter(row => row.watchlist) : data;
                setRows(visibleRows);
                // Mostre os dados privados imediatamente; os metadados públicos apenas os complementam.
                for (const id of new Set(visibleRows.map(row => row.tmdb_id))) {
                    getMovie(id, { signal }).then(movie => {
                        if (isCurrent() && movie?.title) {
                            setMovies(previous => new Map(previous).set(id, { ...movie, id: movie.id ?? id }));
                        }
                    }).catch(() => { /* Mantenha o título alternativo quando o TMDB estiver indisponível. */ });
                }
            } catch (loadError) {
                if (isCurrent()) setError(loadError);
            }
        }

        load();
        return () => controller.abort();
    }, [loadRows, token, watchlistOnly]);

    return {
        rows,
        error,
        movieFor: id => movies.get(id) ?? { id, title: `Filme #${id}` },
    };
}
