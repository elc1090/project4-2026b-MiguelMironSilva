import { useCallback, useEffect, useRef, useState } from "react";

import {
clearToken,
getCurrentUser,
login,
logout,
register,
} from "./services/api.js";

import Header from "./components/Header.jsx";
import AuthPanel from "./components/AuthPanel.jsx";
import MovieSearch from "./components/MovieSearch.jsx";
import MovieDetails from "./components/MovieDetails.jsx";
import MyMovies from "./components/MyMovies.jsx";
import AdminArea from "./components/AdminArea.jsx";
import { canAccessAdmin } from "./services/adminPolicy.js";

function App() {
const [currentUser, setCurrentUser] = useState(null);
const [currentMovie, setCurrentMovie] = useState(null);
const [currentView, setCurrentView] = useState("search");
const [showAuthPanel, setShowAuthPanel] = useState(false);
const [isDarkMode, setIsDarkMode] = useState(false);
const [isInitializing, setIsInitializing] = useState(true);
const sessionRevision = useRef(0);

const handleAdminAccessDenied = useCallback(async (status) => {
    const revision = ++sessionRevision.current;
    // Never leave stale admin UI visible while /auth/me is being refreshed.
    setCurrentUser(user => user ? { ...user, is_superuser: false } : null);
    if (status === 401) {
        clearToken();
        setCurrentUser(null);
        return;
    }
    try {
        const user = await getCurrentUser();
        if (revision === sessionRevision.current) {
            // /admin/me denial takes precedence over an inconsistent/stale /auth/me.
            setCurrentUser({ ...user, is_superuser: false });
        }
    } catch (error) {
        if (revision !== sessionRevision.current) return;
        if (error.status === 401) {
            clearToken();
            setCurrentUser(null);
        }
        // On network/server errors retain the conservatively hidden admin role.
    }
}, []);


useEffect(() => {
    const restoreSession = async () => {
        try {
            const user = await getCurrentUser();

            setCurrentUser(user);
        } catch (error) {
            clearToken();
            setCurrentUser(null);
        } finally {
            setIsInitializing(false);
        }
    };

    restoreSession();
}, []);


const handleLogin = async (username, password) => {
    ++sessionRevision.current;
    await login(username, password);

    const user = await getCurrentUser();

    setCurrentUser(user);
    setShowAuthPanel(false);
    setCurrentView("search");
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


const handleLogout = () => {
    ++sessionRevision.current;
    logout();

    setCurrentUser(null);
    setCurrentMovie(null);
    setCurrentView("search");
    setShowAuthPanel(false);
};


const handleMovieSelected = (movie) => {
    setCurrentMovie(movie);
    setCurrentView("details");
};


const handleOpenMyMovies = () => {
    setCurrentView("library");
    setCurrentMovie(null);
};


const handleOpenAdmin = () => {
    if (!canAccessAdmin(currentUser)) return;
    setCurrentMovie(null);
    setShowAuthPanel(false);
    setCurrentView("admin");
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
            onMyMovies={handleOpenMyMovies}
            onAdmin={handleOpenAdmin}
            onLogout={handleLogout}
            onToggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
        />


        {showAuthPanel && (
            <AuthPanel
                onLogin={handleLogin}
                onRegister={handleRegister}
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
                    movie={currentMovie}
                    currentUser={currentUser}
                    onBack={handleBackToSearch}
                />
            )}


        {currentView === "library" &&
            currentUser && (
                <MyMovies
                    currentUser={currentUser}
                    onMovieSelected={handleMovieSelected}
                    onBack={handleBackToSearch}
                />
            )}
    </div>
);

}

export default App;
