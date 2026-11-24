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
        <main className="page-shell panel-page admin-area" id="main-content" tabIndex={-1} aria-labelledby="admin-heading">
            <div className="panel-page-header">
                <div>
                    <p className="eyebrow">Gestão / Acesso restrito</p>
                    <h1 id="admin-heading">Área administrativa</h1>
                    <p className="panel-intro">Gerencie contas e permissões de acesso.</p>
                </div>
                <button className="button-secondary panel-back" type="button" onClick={onBack}>
                    <span aria-hidden="true" />Pesquisar
                </button>
            </div>
            <div className="panel-admin-content">
                {allowed && (!sessionMatches || result.status === "loading") && (
                    <p className="panel-empty" role="status">Confirmando acesso administrativo no servidor...</p>
                )}
                {error && (
                    <div className="panel-empty" role="alert">
                        <p>{adminErrorMessage(error)}</p>
                        {error.status === 401 ? (
                            <button className="button-secondary" type="button" onClick={onLogin}>
                                Fazer login
                            </button>
                        ) : allowed && error.status !== 403 && (
                            <button className="button-secondary" type="button" onClick={() => setAttempt(value => value + 1)}>
                                Tentar novamente
                            </button>
                        )}
                    </div>
                )}
                {confirmed && (
                    <>
                        <section className="panel-surface panel-admin-session" aria-label="Sessão administrativa">
                            <div>
                                <p className="eyebrow">Sessão administrativa</p>
                                <p className="panel-admin-verified" role="status">Papel de Superusuário confirmado pelo servidor.</p>
                            </div>
                            <dl className="panel-admin-identity">
                                <div><dt>Usuário</dt><dd>{result.identity.username}</dd></div>
                                <div><dt>Email</dt><dd>{result.identity.email}</dd></div>
                                <div><dt>ID</dt><dd>{result.identity.id}</dd></div>
                            </dl>
                        </section>
                        <AdminUsers viewerId={userId} token={token} onAccessDenied={handleAccessDenied} />
                    </>
                )}
            </div>
        </main>
    );
}

export default AdminArea;
