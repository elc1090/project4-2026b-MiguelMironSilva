import { useCallback, useEffect, useRef, useState } from "react";

import {
clearToken,
deleteCurrentUser,
getCurrentUser,
getToken,
login,
logout,
register,
setToken,
} from "./services/api.js";
import { googleSignInError } from "./services/googleAuth.js";

import Header from "./components/Header.jsx";
import AuthPanel from "./components/AuthPanel.jsx";
import MovieSearch from "./components/MovieSearch.jsx";
import MovieDetails from "./components/MovieDetails.jsx";
import MyMovies from "./components/MyMovies.jsx";
import MyReviews from "./components/MyReviews.jsx";
import AdminArea from "./components/AdminArea.jsx";
import AccountArea from "./components/AccountArea.jsx";
import { canAccessAdmin } from "./services/adminPolicy.js";

const NO_ACCOUNT_DELETION = { pending: false, error: null };

function App({ googleCallback = null } = {}) {
const [currentUser, setCurrentUser] = useState(null);
const [currentMovie, setCurrentMovie] = useState(null);
const [currentView, setCurrentView] = useState("search");
const [showAuthPanel, setShowAuthPanel] = useState(false);
const [isDarkMode, setIsDarkMode] = useState(false);
const [isInitializing, setIsInitializing] = useState(true);
const detailsOrigin = useRef("search");
const sessionRevision = useRef(0);
const authenticatedSession = useRef(null);
const activeAccountDeletion = useRef(null);
const [accountDeletion, setAccountDeletion] = useState(NO_ACCOUNT_DELETION);
const [accountNotice, setAccountNotice] = useState(null);
const [googleNotice, setGoogleNotice] = useState(null);
const accountNoticeRef = useRef(null);

const resetAccountSession = useCallback(() => {
    authenticatedSession.current = null;
    activeAccountDeletion.current?.abort();
    activeAccountDeletion.current = null;
    setAccountDeletion(NO_ACCOUNT_DELETION);
}, []);

useEffect(() => () => activeAccountDeletion.current?.abort(), []);

const handleAdminAccessDenied = useCallback(async (status) => {
    const revision = ++sessionRevision.current;
    // Never leave stale admin UI visible while /auth/me is being refreshed.
    setCurrentUser(user => user ? { ...user, is_superuser: false } : null);
    if (status === 401) {
        resetAccountSession();
        clearToken();
        setCurrentUser(null);
        return;
    }
    const token = getToken();
    try {
        const user = await getCurrentUser();
        if (revision === sessionRevision.current && getToken() === token) {
            // An admin endpoint's denial takes precedence over /auth/me for this session.
            setCurrentUser({ ...user, is_superuser: false });
        }
    } catch (error) {
        if (revision !== sessionRevision.current || getToken() !== token) return;
        if (error.status === 401) {
            resetAccountSession();
            clearToken();
            setCurrentUser(null);
        }
        // On network/server errors retain the conservatively hidden admin role.
    }
}, [resetAccountSession]);


useEffect(() => {
    let active = true;
    const token = getToken();
    const revision = sessionRevision.current;
    const isCurrent = () => active && sessionRevision.current === revision && getToken() === token;

    const initializeSession = async () => {
        try {
            let googleError = googleCallback?.error;
            if (googleCallback?.complete) {
                try {
                    const next = await googleCallback.complete();
                    if (!isCurrent()) return;
                    setToken(next.token);
                    authenticatedSession.current = { token: next.token };
                    setCurrentUser(next.user);
                    return;
                } catch {
                    googleError = "failed";
                }
            }

            if (!isCurrent()) return;
            let user = null;
            if (token) {
                try {
                    user = await getCurrentUser({ token });
                    if (!isCurrent()) return;
                    authenticatedSession.current = { token };
                    setCurrentUser(user);
                } catch (error) {
                    if (!isCurrent()) return;
                    // A failed Google attempt is not evidence that the old session is invalid.
                    if (!googleError || error.status === 401) clearToken();
                }
            }
            if (googleError) {
                setGoogleNotice(googleSignInError(googleError));
                if (!user) setShowAuthPanel(true);
            }
        } finally {
            if (active) setIsInitializing(false);
        }
    };

    initializeSession();
    return () => { active = false; };
}, [googleCallback]);


const handleLogin = async (username, password) => {
    const revision = ++sessionRevision.current;
    resetAccountSession();
    const { access_token: token } = await login(username, password);
    if (revision !== sessionRevision.current || getToken() !== token) return;

    const user = await getCurrentUser();
    if (revision !== sessionRevision.current || getToken() !== token) return;

    authenticatedSession.current = { token };
    setCurrentUser(user);
    setAccountNotice(null);
    setGoogleNotice(null);
    setShowAuthPanel(false);
    setCurrentView((view) => view === "details" ? view : "search");
};

useEffect(() => {
    if (showAuthPanel) document.getElementById("login-username")?.focus();
}, [showAuthPanel]);

useEffect(() => {
    if (accountNotice?.kind === "success") accountNoticeRef.current?.focus();
}, [accountNotice]);

const handleReviewLogin = () => {
    if (currentUser) {
        // A signed-in user only sees the review login action after a 401.
        ++sessionRevision.current;
        resetAccountSession();
        clearToken();
        setCurrentUser(null);
    }
    setShowAuthPanel(true);
    if (showAuthPanel) document.querySelector(".auth-panel input")?.focus();
};


const handleRegister = async (
    username,
    email,
    password
) => {
    await register(
        username,
        email,
        password
    );
};


const endSession = (notice = null) => {
    ++sessionRevision.current;
    resetAccountSession();
    logout();

    setCurrentUser(null);
    setCurrentMovie(null);
    setCurrentView("search");
    setAccountNotice(notice);
    setGoogleNotice(null);
    setShowAuthPanel(notice?.kind === "login");
};

const handleDeleteAccount = async (password) => {
    const session = authenticatedSession.current;
    if (currentUser?.has_password === false || !session || session.token !== getToken() || activeAccountDeletion.current) return;

    // The mutation belongs to the session, not the view: leaving Minha conta
    // must not prevent a completed deletion from signing that session out.
    const controller = new AbortController();
    activeAccountDeletion.current = controller;
    const isCurrent = () => !controller.signal.aborted
        && authenticatedSession.current === session && getToken() === session.token;
    setAccountDeletion({ pending: true, error: null });

    try {
        await deleteCurrentUser(password, { signal: controller.signal });
        if (isCurrent()) endSession({ kind: "success", text: "Sua conta foi excluída definitivamente." });
    } catch (error) {
        if (!isCurrent()) return;
        if (error.status === 401) {
            endSession({ kind: "login", text: "Sua sessão expirou. Faça login para excluir sua conta." });
        } else {
            setAccountDeletion({ pending: false, error: error.status ?? "network" });
        }
    } finally {
        if (activeAccountDeletion.current === controller) activeAccountDeletion.current = null;
    }
};


const handleMovieSelected = (movie) => {
    detailsOrigin.current = currentView;
    setCurrentMovie(movie);
    setCurrentView("details");
};

const handleBackFromDetails = () => {
    setCurrentMovie(null);
    setCurrentView(currentUser ? detailsOrigin.current : "search");
};

const openPersonalList = (view) => {
    if (!currentUser) return;
    setCurrentView(view);
    setCurrentMovie(null);
    setShowAuthPanel(false);
};


const handleOpenAdmin = () => {
    if (!canAccessAdmin(currentUser)) return;
    setCurrentMovie(null);
    setShowAuthPanel(false);
    setCurrentView("admin");
};

const handleOpenAccount = () => {
    if (!currentUser || !authenticatedSession.current || authenticatedSession.current.token !== getToken()) return;
    setCurrentMovie(null);
    setShowAuthPanel(false);
    setCurrentView("account");
};

const handleBackToSearch = () => {
    setCurrentView("search");
    setCurrentMovie(null);
};


const toggleTheme = () => {
    setIsDarkMode(
        previousValue => !previousValue
    );
};


if (isInitializing) {
    return (
        <div className="app">
            <p>Carregando...</p>
        </div>
    );
}


return (
    <div
        className={
            isDarkMode
                ? "app dark-theme"
                : "app light-theme"
        }
    >
        <Header
            user={currentUser}
            onLogin={() => setShowAuthPanel(true)}
            onMyMovies={() => openPersonalList("library")}
            onMyReviews={() => openPersonalList("my-reviews")}
            onWatchlist={() => openPersonalList("watchlist")}
            view={currentView}
            onAdmin={handleOpenAdmin}
            onAccount={handleOpenAccount}
            isAccountOpen={currentView === "account"}
            onLogout={() => endSession()}
            onToggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
        />


        {accountNotice && (
            <p className="account-notice" role={accountNotice.kind === "login" ? "alert" : "status"}
                ref={accountNoticeRef} tabIndex={-1}>
                {accountNotice.text}
            </p>
        )}

        {googleNotice && <p className="account-notice" role="alert">{googleNotice}</p>}

        {showAuthPanel && (
            <AuthPanel
                onLogin={handleLogin}
                onRegister={handleRegister}
            />
        )}


        {currentView === "account" && currentUser && (
            <AccountArea
                key={currentUser.id}
                user={currentUser}
                pending={accountDeletion.pending}
                error={accountDeletion.error}
                onClearError={() => {
                    if (accountDeletion.error !== null) setAccountDeletion(NO_ACCOUNT_DELETION);
                }}
                onDelete={handleDeleteAccount}
                onBack={handleBackToSearch}
            />
        )}

        {currentView === "admin" && (
            <AdminArea
                user={currentUser}
                onBack={handleBackToSearch}
                onLogin={() => setShowAuthPanel(true)}
                onAccessDenied={handleAdminAccessDenied}
            />
        )}

        {currentView === "search" && (
            <MovieSearch
                onMovieSelected={handleMovieSelected}
            />
        )}


        {currentView === "details" &&
            currentMovie && (
                <MovieDetails
                    key={currentMovie.id}
                    movie={currentMovie}
                    currentUser={currentUser}
                    onLogin={handleReviewLogin}
                    onBack={handleBackFromDetails}
                />
            )}


        {currentUser && (currentView === "library" || currentView === "watchlist") && (
            <MyMovies
                key={`${currentUser.id}:${currentView}`}
                currentUser={currentUser}
                watchlistOnly={currentView === "watchlist"}
                onMovieSelected={handleMovieSelected}
                onBack={handleBackToSearch}
            />
        )}

        {currentUser && currentView === "my-reviews" && (
            <MyReviews
                key={currentUser.id}
                currentUser={currentUser}
                onMovieSelected={handleMovieSelected}
                onBack={handleBackToSearch}
            />
        )}
    </div>
);

}

export default App;
