const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

export default function MovieCard({ movie, state, onClick }) {
    const statusParts = [];
    if (state?.favorite) statusParts.push("Favoritado");
    if (state?.watched) statusParts.push("Assistido");
    if (state?.watchlist) statusParts.push("Desejo assistir");
    const year = typeof movie.release_date === "string" ? movie.release_date.slice(0, 4) : "";

    return (
        <article
            className="my-movie-card"
            onClick={onClick}
            tabIndex={0}
            role="button"
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onClick();
                }
            }}
        >
            <div className="my-movie-art">
                {movie.poster_path ? (
                    <img src={`${IMAGE_BASE_URL}${movie.poster_path}`} alt={`${movie.title} Poster`} loading="lazy" />
                ) : (
                    <div className="my-movie-art-placeholder" aria-hidden="true">
                        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.25">
                            <rect x="3" y="5" width="22" height="18" rx="2" />
                            <path d="M8 5v18M20 5v18M3 11h5m-5 6h5m12-6h5m-5 6h5" />
                        </svg>
                        <span>Sem pôster</span>
                    </div>
                )}
            </div>
            <div className="my-movie-body">
                <div className="my-movie-title">
                    <h2>{movie.title}</h2>
                    <span aria-hidden="true">↗</span>
                </div>
                {year && <span className="my-movie-year">{year}</span>}
                <p className="my-movie-status">{statusParts.join(" · ") || "Nenhum estado salvo"}</p>
            </div>
        </article>
    );
}
