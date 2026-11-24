import { useId } from "react";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

function CastList({ cast = [] }) {
    const titleId = useId();
    if (cast.length === 0) return null;

    return (
        <section className="movie-detail-cast" aria-labelledby={titleId}>
            <header className="movie-detail-section-heading">
                <p className="eyebrow">Créditos</p>
                <h2 id={titleId}>Elenco</h2>
            </header>

            <ul className="movie-detail-cast-list">
                {cast.map((person) => (
                    <li className="movie-detail-cast-card" key={`${person.id}-${person.cast_id ?? person.order}`}>
                        <div className="movie-detail-cast-portrait">
                            {person.profile_path && (
                                <img
                                    key={person.profile_path}
                                    src={`${IMAGE_BASE_URL}${person.profile_path}`}
                                    alt=""
                                    loading="lazy"
                                    onError={(event) => { event.currentTarget.hidden = true; }}
                                />
                            )}
                            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
                                <circle cx="16" cy="10" r="5" />
                                <path d="M6 27v-2a10 8 0 0 1 20 0v2" />
                            </svg>
                        </div>
                        <div className="movie-detail-cast-caption">
                            <p>{person.name}</p>
                            {person.character && <span>{person.character}</span>}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default CastList;
