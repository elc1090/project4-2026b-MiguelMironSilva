import { canAccessAdmin } from "../services/adminPolicy.js";

function FilmMark() {
    return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="5" y="5" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 5v22m12-22v22M5 12h5m-5 8h5m12-8h5m-5 8h5m-13-8 5 4-5 4v-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    );
}

function Header({
    user, onSearch, onLogin, onMyMovies, onMyReviews, onWatchlist, view,
    onAdmin, onAccount, isAccountOpen, onLogout, onToggleTheme, isDarkMode,
}) {
    const current = (name) => view === name ? "page" : undefined;
    const isAdmin = canAccessAdmin(user);

    return (
        <header className="site-header">
            <div className="header-inner page-shell">
                <button type="button" className="site-brand" onClick={onSearch} aria-label="Miguel Cinema — início">
                    <span className="brand-icon"><img src={`${import.meta.env.BASE_URL}images/cinema-mark.svg`} alt="" width={28} height={28} /></span>
                    <span>Miguel <strong>Cinema</strong><small>DATABASE DE FILMES</small></span>
                </button>

                <nav className="primary-nav" aria-label="Navegação principal">
                    <button type="button" onClick={onSearch} aria-current={current("search")}>Explorar</button>
                    {user && <>
                        <button type="button" onClick={onMyMovies} aria-current={current("library")}>Meus Filmes</button>
                        <button type="button" onClick={onWatchlist} aria-current={current("watchlist")}>Desejo assistir</button>
                        <button type="button" onClick={onMyReviews} aria-current={current("my-reviews")}>Minhas Resenhas</button>
                        {isAdmin && <button type="button" onClick={onAdmin} aria-current={current("admin")}>Administração</button>}
                    </>}
                </nav>

                <div className="header-actions">
                    <button type="button" className="theme-toggle" onClick={onToggleTheme}
                        aria-label={isDarkMode ? "Mudar para modo claro" : "Mudar para modo escuro"}
                        title={isDarkMode ? "Modo claro" : "Modo escuro"}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                            {isDarkMode ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> :
                                <path d="M20.6 15A8.5 8.5 0 0 1 9 3.4 9 9 0 1 0 20.6 15Z"/>}
                        </svg>
                    </button>
                    {user ? (
                        <div id="user-controls" className="header-account">
                            <div className="profile-identity">
                                <span className="profile-initial" aria-hidden="true">{Array.from(user.username ?? "")[0]?.toUpperCase() || "?"}</span>
                                <span id="username-display">{user.username}</span>
                            </div>
                            <button type="button" className="profile-button" onClick={onAccount}
                                aria-current={isAccountOpen ? "page" : undefined}>Minha conta</button>
                            {isAdmin && <span className="superuser-badge">Superusuário</span>}
                            <button type="button" className="logout-button" onClick={onLogout}>Logout</button>
                        </div>
                    ) : (
                        <button type="button" id="login-btn" className="button-primary" onClick={onLogin}>
                            Login
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;
