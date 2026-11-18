import { useCallback, useEffect, useState } from "react";
import { getAdminIdentity, getToken } from "../services/api.js";
import { adminErrorMessage, canAccessAdmin } from "../services/adminPolicy.js";
import AdminUsers from "./AdminUsers.jsx";

function AdminArea({ user, onBack, onLogin, onAccessDenied }) {
    const [result, setResult] = useState({ status: "loading" });
    const [attempt, setAttempt] = useState(0);
    const userId = user?.id;
    const allowed = canAccessAdmin(user);
    const token = typeof sessionStorage === "undefined" ? null : getToken();

    const handleAccessDenied = useCallback((status) => {
        setResult({ status: "error", userId, token, error: { status } });
        onAccessDenied(status);
    }, [userId, token, onAccessDenied]);

    useEffect(() => {
        if (!allowed) {
            setResult({ status: "loading" });
            return;
        }
        const controller = new AbortController();
        const { signal } = controller;
        const isCurrent = () => !signal.aborted && getToken() === token;
        setResult({ status: "loading", userId, token });

        const verifyAccess = async () => {
            if (!isCurrent()) return;
            try {
                const identity = await getAdminIdentity({ signal });
                if (!isCurrent()) return;
                if (!userId || identity?.id !== userId || !canAccessAdmin(identity)) {
                    handleAccessDenied(403);
                    return;
                }
                setResult({ status: "confirmed", userId, token, identity });
            } catch (error) {
                if (!isCurrent()) return;
                if (error.status === 401 || error.status === 403) {
                    handleAccessDenied(error.status);
                } else {
                    setResult({ status: "error", userId, token, error });
                }
            }
        };
        verifyAccess();
        return () => controller.abort();
    }, [userId, token, allowed, attempt, handleAccessDenied]);

    const sessionMatches = result.userId === userId && result.token === token;
    const error = !allowed ? { status: userId ? 403 : 401 } : sessionMatches && result.error;
    const confirmed = allowed && sessionMatches && result.status === "confirmed";

    return (
        <main className="admin-area" aria-labelledby="admin-heading">
            <button className="movie-back-btn" type="button" onClick={onBack}>
                Voltar à pesquisa
            </button>
            <h1 id="admin-heading">Área administrativa</h1>
            <div className="admin-card">
                {allowed && (!sessionMatches || result.status === "loading") && (
                    <p role="status">Confirmando acesso administrativo no servidor...</p>
                )}
                {error && (
                    <div role="alert">
                        <p>{adminErrorMessage(error)}</p>
                        {error.status === 401 ? (
                            <button className="movie-back-btn" type="button" onClick={onLogin}>
                                Fazer login
                            </button>
                        ) : allowed && error.status !== 403 && (
                            <button className="movie-back-btn" type="button" onClick={() => setAttempt(value => value + 1)}>
                                Tentar novamente
                            </button>
                        )}
                    </div>
                )}
                {confirmed && (
                    <>
                        <p role="status">Papel de Superusuário confirmado pelo servidor.</p>
                        <dl className="admin-identity">
                            <dt>ID</dt><dd>{result.identity.id}</dd>
                            <dt>Usuário</dt><dd>{result.identity.username}</dd>
                            <dt>Email</dt><dd>{result.identity.email}</dd>
                        </dl>
                        <AdminUsers viewerId={userId} token={token} onAccessDenied={handleAccessDenied} />
                    </>
                )}
            </div>
        </main>
    );
}

export default AdminArea;
