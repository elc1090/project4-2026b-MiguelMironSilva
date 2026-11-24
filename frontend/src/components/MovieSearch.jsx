import { useEffect, useRef, useState } from "react";
import { ApiConnectionError, searchMovies } from "../services/api.js";

const suggestions = [
    { title: "Interestelar", genre: "Ficção científica", year: "2014", art: "orbit" },
    { title: "O Grande Hotel Budapeste", genre: "Comédia dramática", year: "2014", art: "hotel" },
    { title: "A Viagem de Chihiro", genre: "Animação", year: "2001", art: "gate" },
    { title: "Parasita", genre: "Suspense", year: "2019", art: "house" },
];

function SearchIcon() {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
}

function EditArt({ art }) {
    return (
        <svg viewBox="0 0 240 112" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
            {art === "orbit" && <>
                <path fill="#222a3c" d="M0 0h240v112H0z"/><circle cx="150" cy="63" r="42" fill="#c48a60"/>
                <path d="M142 22a42 42 0 0 0 50 50 42 42 0 1 1-50-50" fill="#544052"/>
                <ellipse cx="148" cy="63" rx="80" ry="15" transform="rotate(-22 148 63)" stroke="#f7d898"/>
                <path d="M30 40h14m-7-7v14M204 24h10m-5-5v10" stroke="#f7d898"/><circle cx="68" cy="77" r="2" fill="#f7d898"/>
            </>}
            {art === "hotel" && <>
                <path fill="#764052" d="M0 0h240v112H0z"/><circle cx="172" cy="38" r="27" fill="#efb08d"/>
                <path d="m0 104 54-65 34 31 28-37 28 28 36-9 60 42v18H0Z" fill="#512b42"/>
                <path d="M65 114V65h30V43h50v22h30v49m-83-71 28-18 28 18M65 65l15-12 15 12m50 0 15-12 15 12" fill="#cf8292" stroke="#f9bfaa" strokeWidth="2"/>
                <path d="M80 76v12m21-30v13m19-13v13m19-13v13m21 5v12m-59-7v13m38-13v13m-19 17V87" stroke="#532e44" strokeWidth="5"/>
            </>}
            {art === "gate" && <>
                <path fill="#294c54" d="M0 0h240v112H0z"/><circle cx="134" cy="47" r="34" fill="#e2aa75"/>
                <path d="M0 87q50-24 113 0t127-13v38H0Z" fill="#1a3b40"/>
                <path d="M0 100q62-13 112-1t128-9" stroke="#527f75"/>
                <path d="M91 94V51m83 43V51m-98 6h113M68 34q67 19 129 0m-62 5v18" stroke="#ed9273" strokeWidth="5"/>
                <path d="M91 95h83" stroke="#e2aa75" strokeDasharray="4 4"/>
            </>}
            {art === "house" && <>
                <path fill="#2b3d32" d="M0 0h240v112H0z"/><path d="m0 83 240-47v76H0Z" fill="#394f3c"/>
                <path d="M49 94h156V52h-43V30H88v22H49v42Z" fill="#151e1b" stroke="#bac69d"/>
                <path d="M88 52h74m-101 13h58v16H61z" stroke="#bac69d"/><path d="M138 64h54v18h-54z" fill="#d7b477"/>
                <path d="M155 64v18m18-18v18M37 94h180" stroke="#151e1b" strokeWidth="2"/>
                <path d="M25 25h22m-11-11v22" stroke="#bac69d" opacity=".6"/>
            </>}
        </svg>
    );
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
                    <img src={`${import.meta.env?.BASE_URL ?? "/"}images/cinema-horizon.svg`} alt="" width="680" height="520" fetchPriority="high" />
                    <div className="hero-viewfinder"><span>FIG. 01</span><span>LUZ NO HORIZONTE</span></div>
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

            {term ? (
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
            ) : (
                <section className="discovery-section" aria-labelledby="suggestions-title">
                    <div className="discovery-heading">
                        <div><p className="eyebrow">PARA COMEÇAR</p><h2 id="suggestions-title">Qual vai ser a sessão?</h2></div>
                        <span>Escolha um título para buscar</span>
                    </div>
                    <ul className="editorial-grid">
                        {suggestions.map(({ title, genre, year, art }, index) => (
                            <li key={title}>
                                <button type="button" className="editorial-card" onClick={() => { setQuery(title); searchInput.current?.focus(); }}>
                                    <div className="editorial-art"><EditArt art={art} /><span aria-hidden="true">0{index + 1}</span></div>
                                    <div className="editorial-card-body">
                                        <span className="editorial-meta">{genre} <span aria-hidden="true">·</span> {year}</span>
                                        <strong>{title}</strong>
                                        <span className="editorial-arrow" aria-hidden="true">↗</span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </main>
    );
}

export default MovieSearch;
