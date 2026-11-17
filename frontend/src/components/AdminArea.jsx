import { useEffect, useState } from "react";
import { getAdminIdentity } from "../services/api.js";
import { adminErrorMessage, canAccessAdmin } from "../services/adminPolicy.js";

function AdminArea({ user, onBack, onLogin, onAccessDenied }) {
    const [result, setResult] = useState({ status: "loading" });
    const [attempt, setAttempt] = useState(0);
    const userId = user?.id;
    const allowed = canAccessAdmin(user);

    useEffect(() => {
        let active = true;
        if (!allowed) {
            setResult({ status: "error", error: { status: userId ? 403 : 401 } });
            return () => { active = false; };
        }
        setResult({ status: "loading" });
        const verifyAccess = async () => {
            try {
                const identity = await getAdminIdentity();
                if (!active) return;
                if (!canAccessAdmin(identity)) {
                    const error = new Error("Papel administrativo não confirmado.");
                    error.status = 403;
                    throw error;
                }
                setResult({ status: "confirmed", identity });
            } catch (error) {
                if (!active) return;
                // Drop any previous confirmation before refreshing session identity.
                setResult({ status: "error", error });
                if (error.status === 401 || error.status === 403) {
                    onAccessDenied(error.status);
                }
            }
        };
        verifyAccess();
        return () => { active = false; };
    }, [userId, allowed, attempt, onAccessDenied]);

    const error = !allowed
        ? { status: userId ? 403 : 401 }
        : result.error;
    const confirmed = allowed && result.status === "confirmed"
        && result.identity.id === userId;

    return (
        <main className="admin-area" aria-labelledby="admin-heading">
            <button className="movie-back-btn" type="button" onClick={onBack}>
                Voltar à pesquisa
            </button>
            <h1 id="admin-heading">Área administrativa</h1>
            <div className="admin-card">
                {allowed && result.status === "loading" && (
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
                    </>
                )}
                <p>As funções de moderação e resenhas virão nas próximas etapas.</p>
            </div>
        </main>
    );
}

export default AdminArea;
