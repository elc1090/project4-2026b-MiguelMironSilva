import { useEffect, useId, useRef, useState } from "react";
import { deleteAdminUser, getAdminUsers, getToken } from "../services/api.js";

const LOADING = { users: null, error: "" };
const isAccessDenied = (status) => status === 401 || status === 403;

export default function AdminUsers({ viewerId, token, onAccessDenied }) {
    const headingId = useId();
    const warningId = useId();
    const [list, setList] = useState(LOADING);
    const [attempt, setAttempt] = useState(0);
    const [targetId, setTargetId] = useState(null);
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState(null);
    const activeDelete = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const isCurrent = () => !signal.aborted && getToken() === token;

        async function loadUsers() {
            if (!isCurrent()) return;
            try {
                const users = await getAdminUsers({ signal });
                if (!isCurrent()) return;
                if (!Array.isArray(users) || users.some((user) => (
                    typeof user?.id !== "string" || !user.id
                    || typeof user.username !== "string" || typeof user.is_superuser !== "boolean"
                ))) {
                    throw new Error("Lista de usuários inválida.");
                }
                setList({ users, error: "" });
            } catch (error) {
                if (!isCurrent()) return;
                if (isAccessDenied(error.status)) {
                    onAccessDenied(error.status);
                    return;
                }
                setList({ users: null, error: "Não foi possível carregar os usuários." });
            }
        }

        loadUsers();
        return () => controller.abort();
    }, [token, attempt, onAccessDenied]);

    useEffect(() => () => activeDelete.current?.abort(), []);

    function reloadUsers() {
        setList(LOADING);
        setAttempt((value) => value + 1);
    }

    async function confirmDelete(userId) {
        if (userId === viewerId || userId !== targetId || activeDelete.current || getToken() !== token) return;
        const target = list.users?.find((user) => user.id === userId);
        if (!target) return;

        const controller = new AbortController();
        const { signal } = controller;
        const isCurrent = () => !signal.aborted && getToken() === token;
        activeDelete.current = controller;
        setPending(true);
        setNotice(null);

        try {
            await deleteAdminUser(target.id, { signal });
            if (!isCurrent()) return;
            setList(({ users, error }) => ({ users: users.filter((user) => user.id !== target.id), error }));
            setTargetId(null);
            setNotice({ text: `Conta de ${target.username} excluída.` });
        } catch (error) {
            if (!isCurrent()) return;
            if (isAccessDenied(error.status)) {
                onAccessDenied(error.status);
                return;
            }
            if (error.status === 404 || error.status === 409) {
                setNotice({ error: true, text: error.status === 404
                    ? `A conta de ${target.username} não foi encontrada. Atualizando a lista.`
                    : `Não foi possível excluir a conta de ${target.username} por um conflito. Você não pode excluir a própria conta.` });
                setTargetId(null);
                reloadUsers();
            } else {
                setNotice({ error: true, text: `Não foi possível excluir a conta de ${target.username}. Tente novamente.` });
            }
        } finally {
            activeDelete.current = null;
            if (isCurrent()) setPending(false);
        }
    }

    return (
        <section className="admin-users" aria-labelledby={headingId}>
            <h2 id={headingId}>Gerenciar usuários</h2>
            {notice && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
            {list.error ? (
                <div>
                    <p role="alert">{list.error}</p>
                    <button className="movie-back-btn" type="button" onClick={reloadUsers}>Tentar novamente</button>
                </div>
            ) : !list.users ? (
                <p role="status">Carregando usuários...</p>
            ) : list.users.length === 0 ? (
                <p>Nenhum usuário encontrado.</p>
            ) : (
                <ul className="admin-users-list">
                    {list.users.map((user) => {
                        const isOwn = user.id === viewerId;
                        return (
                            <li key={user.id}>
                                <div className="admin-user-row">
                                    <div>
                                        <strong>{user.username}</strong>{isOwn && " (você)"}
                                        <span className="admin-user-role">
                                            {user.is_superuser ? "Superusuário" : "Usuário comum"}
                                        </span>
                                    </div>
                                    {!isOwn && targetId !== user.id && (
                                        <button className="admin-delete-button" type="button" disabled={pending}
                                            aria-label={`Excluir conta de ${user.username}`} onClick={() => {
                                                setNotice(null);
                                                setTargetId(user.id);
                                            }}>
                                            Excluir conta
                                        </button>
                                    )}
                                </div>
                                {!isOwn && targetId === user.id && (
                                    <div className="admin-delete-confirmation">
                                        <p id={warningId}>
                                            Excluir a conta de <strong>{user.username}</strong>{user.is_superuser && " (Superusuário)"}?
                                            A conta, as resenhas (notas e textos) e os registros de filmes favoritos e assistidos serão apagados permanentemente.
                                            Esta ação não pode ser desfeita.
                                        </p>
                                        <div className="admin-delete-actions">
                                            <button className="admin-cancel-button" type="button" autoFocus disabled={pending}
                                                onClick={() => { setTargetId(null); setNotice(null); }}>
                                                Cancelar
                                            </button>
                                            <button className="admin-delete-button" type="button" disabled={pending}
                                                aria-describedby={warningId} onClick={() => confirmDelete(user.id)}>
                                                Confirmar exclusão
                                            </button>
                                        </div>
                                        {pending && <p role="status">Excluindo a conta de {user.username}...</p>}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
