import { useEffect, useRef, useState } from "react";
import { ApiConnectionError, searchMovies } from "../services/api.js";

function SearchIcon() {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
}

function SearchResult({ movie, onSelect, firstResult }) {
    const [hasImageError, setHasImageError] = useState(false);
    return (
        <li>
            <button type="button" className="search-result" onClick={() => onSelect(movie)} ref={firstResult}>
                <span className="result-poster" aria-hidden="true">
                    {movie.poster_path && !hasImageError ? (
                        <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt="" loading="lazy" onError={() => setHasImageError(true)} />
                    ) : <span>▧</span>}
                </span>
                <span className="result-title">
                    <strong>{movie.title}</strong>
                    <small>{movie.release_date?.slice(0, 4) || "Ano não informado"}</small>
                </span>
                <span className="result-arrow" aria-hidden="true">↗</span>
            </button>
        </li>
    );
}

function MovieSearch({ onMovieSelected }) {
    const [query, setQuery] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState(null);
    const searchInput = useRef(null);
    const firstResult = useRef(null);
    const term = query.trim();
    const currentResult = result?.term === term && result.attempt === attempt ? result : null;
    const movies = currentResult?.movies ?? [];
    const isLoading = Boolean(term && !currentResult);

    useEffect(() => {
        if (!term) return;
        let cancelled = false;
        const timeout = setTimeout(async () => {
            try {
                const data = await searchMovies(term);
                if (!cancelled) setResult({ term, attempt, movies: Array.isArray(data?.results) ? data.results.slice(0, 10) : [] });
            } catch (error) {
                if (!cancelled) {
                    const message = error instanceof ApiConnectionError
                        ? error.message
                        : error.status === 502
                            ? "O TMDB não respondeu corretamente. Verifique a conexão com a internet e tente novamente."
                            : "Não foi possível consultar o catálogo agora.";
                    setResult({ term, attempt, error: message });
                }
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(timeout); };
    }, [term, attempt]);

    const clearSearch = () => {
        setQuery("");
        setResult(null);
        searchInput.current?.focus();
    };

    return (
        <main className="discovery page-shell" id="main-content" tabIndex={-1}>
            <section className="discovery-hero" aria-labelledby="hero-title">
                <div className="hero-visual" aria-hidden="true">
                    <img src={`${import.meta.env?.BASE_URL ?? "/"}images/cinema-horizon.jpg`} alt="" width={2048} height={1024} fetchPriority="high" />
                </div>
                <div className="hero-content">
                    <p className="eyebrow hero-kicker"><span /> A SESSÃO COMEÇA AQUI</p>
                    <h1 id="hero-title">Toda noite<br />merece <em>um filme.</em></h1>
                    <p className="hero-description">Descubra histórias, organize sua lista e divida suas impressões com quem também gosta de cinema.</p>
                    <form className="search-form" role="search" onSubmit={(event) => {
                        event.preventDefault();
                        firstResult.current?.focus();
                    }}>
                        <div className="search-box">
                            <SearchIcon />
                            <input ref={searchInput} type="search" value={query} id="movie-search" aria-label="Pesquisar filmes"
                                placeholder="Busque pelo título de um filme" autoComplete="off"
                                onChange={(event) => { setQuery(event.target.value); if (event.target.value.trim() !== term) setResult(null); }}
                                onKeyDown={(event) => { if (event.key === "Escape" && query) { event.preventDefault(); clearSearch(); } }} />
                            {query && <button type="button" className="clear-search" onClick={clearSearch} aria-label="Limpar busca">×</button>}
                        </div>
                        <span className="search-caption">BUSCA NO CATÁLOGO TMDB</span>
                    </form>
                </div>
            </section>

            {term && (
                <section className="discovery-section" aria-labelledby="search-title">
                    <div className="discovery-heading">
                        <div><p className="eyebrow">BUSCA NO CATÁLOGO</p><h2 id="search-title">Resultados da busca</h2></div>
                        {currentResult && !currentResult.error && movies.length > 0 && <span>{movies.length} {movies.length === 1 ? "filme exibido" : "filmes exibidos"}</span>}
                    </div>
                    <div role="status" className={isLoading || (currentResult && !currentResult.error && !movies.length) ? "search-state" : "sr-only"}>
                        {isLoading ? "Buscando filmes…" : currentResult?.error ? "" : movies.length > 0 ? `${movies.length} resultado(s) disponível(is).` : "Nenhum filme encontrado. Tente outro título."}
                    </div>
                    {currentResult?.error && <div className="search-state">
                        <p role="alert">{currentResult.error}</p>
                        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>
                    </div>}
                    {movies.length > 0 && <ul className="search-results">
                        {movies.map((movie, index) => <SearchResult key={movie.id} movie={movie} onSelect={onMovieSelected} firstResult={index === 0 ? firstResult : null} />)}
                    </ul>}
                </section>
            )}
        </main>
    );
}

export default MovieSearch;
