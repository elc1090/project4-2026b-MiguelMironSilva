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
                <p className="panel-empty" role="alert">
                    {error.status === 401
                        ? "Sua sessão expirou. Entre novamente para ver seus filmes."
                        : "Não foi possível carregar seus filmes. Tente novamente."}
                </p>
            ) : !visibleRows ? (
                <p className="panel-empty" role="status">Carregando seus filmes...</p>
            ) : visibleRows.length === 0 ? (
                <p className="panel-empty">
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
        <main className="page-shell panel-page my-movies-section" id="main-content" tabIndex={-1} aria-labelledby={titleId}>
            <div className="panel-page-header">
                <div>
                    <p className="eyebrow">Minha coleção / {watchlistOnly ? "Lista de interesse" : "Biblioteca"}</p>
                    <h1 id={titleId}>{watchlistOnly ? "Desejo assistir" : "Meus filmes"}</h1>
                    <p className="panel-intro">{watchlistOnly
                        ? "Os filmes que você guardou para a próxima sessão."
                        : "Seus filmes salvos, favoritos e já assistidos em um só lugar."}</p>
                </div>
                <button className="button-secondary panel-back" type="button" onClick={onBack}>
                    <span aria-hidden="true" />Pesquisar
                </button>
            </div>
            {currentUser ? (
                <MoviesForSession key={JSON.stringify([currentUser.id, token, watchlistOnly])}
                    token={token} watchlistOnly={watchlistOnly} onMovieSelected={onMovieSelected} />
            ) : <p className="panel-empty">Entre para ver seus filmes.</p>}
        </main>
    );
}
