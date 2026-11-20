import { useId, useState } from "react";
import { getMyMovies, getToken } from "../services/api.js";
import MovieCard from "./MovieCard.jsx";
import { usePersonalMovieList } from "./usePersonalMovieList.js";

const FILTERS = [
    ["all", "Todos", "Você ainda não salvou nenhum filme."],
    ["favorite", "Favoritados", "Você não possui filmes favoritados."],
    ["watched", "Vistos", "Você não possui filmes marcados como vistos."],
];

function MoviesForSession({ token, watchlistOnly, onMovieSelected }) {
    const { rows, error, movieFor } = usePersonalMovieList(getMyMovies, token, { watchlistOnly });
    const [filter, setFilter] = useState("all");
    const visibleRows = rows?.filter(state => watchlistOnly || filter === "all" || state[filter]);

    return (
        <>
            {!watchlistOnly && (
                <div className="my-movies-filters" role="group" aria-label="Filtrar meus filmes">
                    {FILTERS.map(([value, name]) => (
                        <button key={value} type="button" className={filter === value ? "active" : ""}
                            aria-pressed={filter === value} onClick={() => setFilter(value)}>
                            {name}
                        </button>
                    ))}
                </div>
            )}
            {error ? (
                <p className="search-error" role="alert">
                    {error.status === 401
                        ? "Sua sessão expirou. Entre novamente para ver seus filmes."
                        : "Não foi possível carregar seus filmes. Tente novamente."}
                </p>
            ) : !visibleRows ? (
                <p className="my-movies-empty" role="status">Carregando seus filmes...</p>
            ) : visibleRows.length === 0 ? (
                <p className="my-movies-empty">
                    {watchlistOnly
                        ? "Você ainda não marcou filmes que deseja assistir."
                        : FILTERS.find(([value]) => value === filter)[2]}
                </p>
            ) : (
                <div className="my-movies-list">
                    {visibleRows.map(state => {
                        const movie = movieFor(state.tmdb_id);
                        return <MovieCard key={state.tmdb_id} movie={movie} state={state}
                            onClick={() => onMovieSelected(movie)} />;
                    })}
                </div>
            )}
        </>
    );
}

export default function MyMovies({ currentUser, onMovieSelected, onBack, watchlistOnly = false }) {
    const titleId = useId();
    const token = currentUser ? getToken() : null;
    return (
        <section className="my-movies-section" aria-labelledby={titleId}>
            <div className="my-movies-header">
                <h1 id={titleId}>{watchlistOnly ? "Desejo assistir" : "My Movies"}</h1>
                <button type="button" onClick={onBack}>Pesquisar</button>
            </div>
            {currentUser ? (
                <MoviesForSession key={JSON.stringify([currentUser.id, token, watchlistOnly])}
                    token={token} watchlistOnly={watchlistOnly} onMovieSelected={onMovieSelected} />
            ) : <p className="my-movies-empty">Entre para ver seus filmes.</p>}
        </section>
    );
}
