import { useCallback, useEffect, useRef, useState } from "react";

import {
claimFirstAdmin,
clearToken,
deleteCurrentUser,
getCurrentUser,
getFirstAdminAvailability,
getToken,
login,
logout,
register,
setToken,
updatePassword,
} from "./services/api.js";
import { googleSignInError } from "./services/googleAuth.js";
import { clearPendingGooglePassword, googlePasswordError, startGooglePassword } from "./services/googlePassword.js";

import Header from "./components/Header.jsx";
import AuthPanel from "./components/AuthPanel.jsx";
import MovieSearch from "./components/MovieSearch.jsx";
import MovieDetails from "./components/MovieDetails.jsx";
import MyMovies from "./components/MyMovies.jsx";
import MyReviews from "./components/MyReviews.jsx";
import AdminArea from "./components/AdminArea.jsx";
import AccountArea from "./components/AccountArea.jsx";
import PasswordArea from "./components/PasswordArea.jsx";
import { canAccessAdmin } from "./services/adminPolicy.js";

const NO_ACCOUNT_DELETION = { pending: false, error: null };
const NO_PASSWORD_ACTION = { pending: null, notice: null };

function App({ googleCallback = null, googlePasswordCallback = null } = {}) {
const [currentUser, setCurrentUser] = useState(null);
const [currentMovie, setCurrentMovie] = useState(null);
const [currentView, setCurrentView] = useState("search");
const [showAuthPanel, setShowAuthPanel] = useState(false);
const [isDarkMode, setIsDarkMode] = useState(true);
const [isInitializing, setIsInitializing] = useState(true);
const detailsOrigin = useRef("search");
const sessionRevision = useRef(0);
const authenticatedSession = useRef(null);
const activeAccountDeletion = useRef(null);
const activePasswordOperation = useRef(null);
const activeFirstAdminClaim = useRef(null);
const [firstAdmin, setFirstAdmin] = useState(null);
const [accountDeletion, setAccountDeletion] = useState(NO_ACCOUNT_DELETION);
const [passwordAction, setPasswordAction] = useState(NO_PASSWORD_ACTION);
const [passwordProof, setPasswordProof] = useState(null);
const [accountNotice, setAccountNotice] = useState(null);
const [googleNotice, setGoogleNotice] = useState(null);
const accountNoticeRef = useRef(null);

const resetAccountSession = useCallback(() => {
    authenticatedSession.current = null;
    activeAccountDeletion.current?.abort();
    activeAccountDeletion.current = null;
    activePasswordOperation.current?.abort();
    activePasswordOperation.current = null;
    activeFirstAdminClaim.current?.abort();
    activeFirstAdminClaim.current = null;
    clearPendingGooglePassword();
    setFirstAdmin(null);
    setAccountDeletion(NO_ACCOUNT_DELETION);
    setPasswordAction(NO_PASSWORD_ACTION);
    setPasswordProof(null);
}, []);

useEffect(() => () => {
    activeAccountDeletion.current?.abort();
    activePasswordOperation.current?.abort();
    activeFirstAdminClaim.current?.abort();
}, []);

const handleAdminAccessDenied = useCallback(async (status) => {
    const revision = ++sessionRevision.current;
    // Nunca mantenha a interface administrativa obsoleta visível enquanto /auth/me é atualizado.
    setFirstAdmin(null);
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
            // A negação de um endpoint administrativo prevalece sobre /auth/me nesta sessão.
            setCurrentUser({ ...user, is_superuser: false });
        }
    } catch (error) {
        if (revision !== sessionRevision.current || getToken() !== token) return;
        if (error.status === 401) {
            resetAccountSession();
            clearToken();
            setCurrentUser(null);
        }
        // Em erros de rede ou servidor, mantenha o papel administrativo oculto por precaução.
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
                    clearPendingGooglePassword();
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
                    const resumePassword = googlePasswordCallback && user?.has_password === false &&
                        await googlePasswordCallback.ownsSession(token, user.id);
                    if (!isCurrent()) return;
                    authenticatedSession.current = { token };
                    setCurrentUser(user);
                    if (resumePassword) {
                        setCurrentView("password");
                        if (googlePasswordCallback.proof) setPasswordProof(googlePasswordCallback.proof);
                        else setPasswordAction({ pending: null, notice: {
                            kind: "error", text: googlePasswordError(googlePasswordCallback.error),
                        } });
                    }
                } catch (error) {
                    if (!isCurrent()) return;
                    // Uma tentativa Google malsucedida não comprova que a sessão anterior seja inválida.
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
}, [googleCallback, googlePasswordCallback]);


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
        // Um usuário conectado só vê a ação de login de avaliações após uma resposta 401.
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

const firstAdminSession = authenticatedSession.current;
const firstAdminUserId = currentUser?.id;
const canCheckFirstAdmin = currentView === "account" && firstAdminUserId != null && !canAccessAdmin(currentUser);
useEffect(() => {
    if (!canCheckFirstAdmin || !firstAdminSession || firstAdminSession.token !== getToken() ||
        activeFirstAdminClaim.current) return;

    const controller = new AbortController();
    const revision = sessionRevision.current;
    const isCurrent = () => !controller.signal.aborted && sessionRevision.current === revision &&
        authenticatedSession.current === firstAdminSession && getToken() === firstAdminSession.token;
    setFirstAdmin(null);
    (async () => {
        try {
            const result = await getFirstAdminAvailability({ token: firstAdminSession.token, signal: controller.signal });
            if (isCurrent() && result?.available === true) {
                setFirstAdmin({ session: firstAdminSession, phase: "available" });
            }
        } catch (error) {
            if (isCurrent() && error?.status === 401) {
                setFirstAdmin({ session: firstAdminSession, phase: "expired" });
            }
            // Uma falha ao verificar a disponibilidade nunca bloqueia o perfil nem a exclusão da conta.
        }
    })();
    return () => controller.abort();
}, [canCheckFirstAdmin, firstAdminSession, firstAdminUserId]);

const handleFirstAdminRelogin = () => {
    if (firstAdminSession && authenticatedSession.current === firstAdminSession &&
        firstAdminSession.token === getToken()) {
        endSession({ kind: "login", text: "Sua sessão expirou. Entre novamente para configurar a administração." });
    }
};

const handleClaimFirstAdmin = async (code) => {
    const session = firstAdminSession;
    if (!session || !canCheckFirstAdmin || firstAdmin?.session !== session || firstAdmin.phase !== "available" ||
        authenticatedSession.current !== session || session.token !== getToken() ||
        activeFirstAdminClaim.current || activeAccountDeletion.current || activePasswordOperation.current ||
        typeof code !== "string" || code.trim() === "") return;

    const controller = new AbortController();
    const revision = sessionRevision.current;
    activeFirstAdminClaim.current = controller;
    const isCurrent = () => !controller.signal.aborted && activeFirstAdminClaim.current === controller &&
        sessionRevision.current === revision && authenticatedSession.current === session && getToken() === session.token;
    const isSameAdmin = (user) => user?.id != null && String(user.id) === String(firstAdminUserId) &&
        user.is_superuser === true;
    setFirstAdmin({ session, phase: "submitting" });
    let accepted = false;
    try {
        const result = await claimFirstAdmin(code, { token: session.token, signal: controller.signal });
        if (!isCurrent()) return;
        accepted = true;
        const token = result?.access_token;
        if (typeof token !== "string" || !token || token === session.token || result.token_type !== "bearer" ||
            !isSameAdmin(result.user)) throw new Error("Resposta inválida ao configurar o primeiro administrador");
        const verified = await getCurrentUser({ token, signal: controller.signal });
        if (!isCurrent()) return;
        if (!isSameAdmin(verified)) throw new Error("Sessão inválida do primeiro administrador");

        // Efetive a alteração somente após o servidor validar a nova sessão para esta mesma conta.
        // Os endpoints privilegiados continuam autorizando as operações no servidor.
        setToken(token);
        ++sessionRevision.current;
        const replacement = { token };
        authenticatedSession.current = replacement;
        setCurrentUser(verified);
        setFirstAdmin({ session: replacement, phase: "success" });
    } catch (error) {
        if (!isCurrent()) return;
        if (accepted) {
            endSession({ kind: "login", text: "Não foi possível confirmar a nova sessão. Entre novamente para verificar o acesso à administração." });
        } else if (error?.status === 401) {
            handleFirstAdminRelogin();
        } else if (error?.status === 409) {
            setFirstAdmin({ session, phase: "closed" });
        } else {
            const message = {
                403: "Código incorreto. Digite o código novamente.",
                422: "O código informado não é válido. Confira e tente novamente.",
            }[error?.status] ?? "Não foi possível concluir a configuração. Tente novamente.";
            setFirstAdmin({ session, phase: "available", error: message });
        }
    } finally {
        if (activeFirstAdminClaim.current === controller) activeFirstAdminClaim.current = null;
    }
};

const beginPasswordOperation = (kind) => {
    const session = authenticatedSession.current;
    if (!currentUser || !session || session.token !== getToken() ||
        activePasswordOperation.current || activeAccountDeletion.current || activeFirstAdminClaim.current) return null;

    const controller = new AbortController();
    activePasswordOperation.current = controller;
    setPasswordAction({ pending: kind, notice: null });
    return {
        token: session.token,
        userId: currentUser.id,
        signal: controller.signal,
        isCurrent: () => !controller.signal.aborted && authenticatedSession.current === session && getToken() === session.token,
        finish: () => {
            if (activePasswordOperation.current === controller) activePasswordOperation.current = null;
        },
    };
};

const passwordFeedback = (kind, text) => setPasswordAction({ pending: null, notice: { kind, text } });

const handleStartGooglePassword = async () => {
    if (currentUser?.has_password !== false) return;
    const operation = beginPasswordOperation("google");
    if (!operation) return;
    setPasswordProof(null);
    try {
        await startGooglePassword(operation);
        if (operation.isCurrent()) setPasswordAction(NO_PASSWORD_ACTION);
    } catch (error) {
        if (!operation.isCurrent()) return;
        if (error.status === 401) {
            endSession({ kind: "login", text: "Sua sessão expirou. Entre novamente para definir uma senha." });
            return;
        }
        const text = {
            403: "Não foi possível confirmar uma conta Google vinculada a este perfil.",
            409: "O estado da senha desta conta mudou. Entre novamente para continuar.",
            503: "A confirmação com Google está indisponível no momento.",
        }[error.status] ?? "Não foi possível iniciar a confirmação com Google. Tente novamente.";
        passwordFeedback("error", text);
    } finally {
        operation.finish();
    }
};

const handleUpdatePassword = async (currentPassword, newPassword) => {
    const settingFirst = currentUser?.has_password === false;
    const proof = settingFirst ? passwordProof : { current_password: currentPassword };
    if (!proof) return;
    const operation = beginPasswordOperation("save");
    if (!operation) return;
    let rotated = false;
    try {
        const result = await updatePassword(proof, newPassword, operation);
        if (!operation.isCurrent()) return;
        rotated = true;
        const token = result?.access_token;
        if (typeof token !== "string" || !token || token === operation.token ||
            result.token_type?.toLowerCase() !== "bearer") throw new Error("Token de substituição inválido");

        // Valide explicitamente a sessão candidata. Não substitua o token anterior nem a identidade
        // da interface até /me aceitá-la para a mesma conta com senha definida.
        const user = await getCurrentUser({ token, signal: operation.signal });
        if (!operation.isCurrent()) return;
        // /me omite has_password para contas locais; o valor false indica uma conta somente Google.
        if (user?.id == null || String(user.id) !== String(operation.userId) || user.has_password === false) {
            throw new Error("Sessão de substituição inesperada");
        }
        setToken(token);
        ++sessionRevision.current;
        authenticatedSession.current = { token };
        setCurrentUser(user);
        setPasswordProof(null);
        clearPendingGooglePassword();
        passwordFeedback("success", settingFirst
            ? "Senha definida. Agora você também pode entrar com seu e-mail e senha."
            : "Senha atualizada com sucesso.");
    } catch (error) {
        if (!operation.isCurrent()) return;
        if (rotated) {
            endSession({ kind: "login", text: "Não foi possível validar a nova sessão. Entre novamente; se a senha foi salva, use a nova senha." });
            return;
        }
        if (error.status === 401) {
            endSession({ kind: "login", text: "Sua sessão expirou. Entre novamente para gerenciar sua senha." });
            return;
        }
        if (settingFirst && [403, 409, 410].includes(error.status)) setPasswordProof(null);
        const text = {
            403: settingFirst ? "A confirmação com Google expirou ou não é válida. Confirme sua conta novamente." : "A senha atual está incorreta.",
            409: "O estado da senha desta conta mudou. Entre novamente para continuar.",
            410: "A confirmação com Google expirou. Confirme sua conta novamente.",
            422: "Confira os campos da senha e tente novamente.",
            429: "Foram feitas muitas tentativas. Aguarde um pouco antes de tentar novamente.",
        }[error.status] ?? "Não foi possível atualizar sua senha. Tente novamente. Se já tiver sido alterada, entre com a nova senha.";
        passwordFeedback("error", text);
    } finally {
        operation.finish();
    }
};

const handleDeleteAccount = async (password) => {
    const session = authenticatedSession.current;
    if (currentUser?.has_password === false || !session || session.token !== getToken() ||
        activeAccountDeletion.current || activePasswordOperation.current || activeFirstAdminClaim.current) return;

    // A alteração pertence à sessão, não à tela: sair de Minha conta
    // não deve impedir que uma exclusão concluída encerre essa sessão.
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

const handleOpenPassword = () => {
    if (!authenticatedSession.current || authenticatedSession.current.token !== getToken()) return;
    openPersonalList("password");
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


useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo(0, 0);
}, [currentView]);

if (isInitializing) {
    return (
        <div className="app dark-theme app-loading">
            <p role="status"><span className="eyebrow">MIGUEL CINEMA</span>Preparando a sessão…</p>
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
        <a className="skip-link" href="#main-content" onClick={(event) => {
            const content = document.getElementById("main-content");
            if (!content) return;
            event.preventDefault();
            content.focus();
        }}>Pular para o conteúdo</a>
        <Header
            user={currentUser}
            onSearch={() => { handleBackToSearch(); setShowAuthPanel(false); }}
            onLogin={() => setShowAuthPanel(true)}
            onMyMovies={() => openPersonalList("library")}
            onMyReviews={() => openPersonalList("my-reviews")}
            onPassword={handleOpenPassword}
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
                onClose={() => {
                    setShowAuthPanel(false);
                    document.getElementById("login-btn")?.focus();
                }}
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
                onPassword={handleOpenPassword}
                onBack={handleBackToSearch}
                firstAdmin={firstAdmin?.session === firstAdminSession ? firstAdmin : null}
                onClaimFirstAdmin={handleClaimFirstAdmin}
                onFirstAdminRelogin={handleFirstAdminRelogin}
                onFirstAdminOpen={handleOpenAdmin}
            />
        )}

        {currentView === "password" && currentUser && (
            <PasswordArea
                key={currentUser.id}
                user={currentUser}
                googleConfirmed={Boolean(passwordProof)}
                pending={passwordAction.pending}
                notice={passwordAction.notice}
                onStartGoogle={handleStartGooglePassword}
                onUpdatePassword={handleUpdatePassword}
                onAccount={handleOpenAccount}
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

        <footer className="site-footer">
            <div className="page-shell footer-inner">
                <span className="footer-brand">Miguel <strong>Cinema</strong></span>
                <span>Dados de filmes fornecidos pelo <a href="https://www.themoviedb.org/">TMDB</a>.</span>
            </div>
        </footer>
    </div>
);

}

export default App;
