import { useEffect, useId, useRef, useState } from "react";
import { deleteAdminUser, getAdminUsers, getToken, promoteAdminUser } from "../services/api.js";

const LOADING = { users: null, error: "" };
const isAccessDenied = (status) => status === 401 || status === 403;

export default function AdminUsers({ viewerId, token, onAccessDenied }) {
    const headingId = useId();
    const warningId = useId();
    const [list, setList] = useState(LOADING);
    const [attempt, setAttempt] = useState(0);
    const [confirmation, setConfirmation] = useState(null);
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState(null);
    const activeMutation = useRef(null);

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

    useEffect(() => () => activeMutation.current?.abort(), []);

    function reloadUsers() {
        setList(LOADING);
        setAttempt((value) => value + 1);
    }

    function askConfirmation(id, action) {
        setNotice(null);
        setConfirmation({ id, action });
    }

    async function confirmAction(userId, action) {
        if (userId === viewerId || userId !== confirmation?.id || action !== confirmation.action
            || activeMutation.current || getToken() !== token) return;
        const target = list.users?.find((user) => user.id === userId);
        const promoting = action === "promote";
        if (!target || (promoting && target.is_superuser)) return;

        const controller = new AbortController();
        const { signal } = controller;
        const isCurrent = () => !signal.aborted && getToken() === token;
        activeMutation.current = controller;
        setPending(true);
        setNotice(null);

        try {
            if (promoting) {
                const updated = await promoteAdminUser(target.id, { signal });
                if (!isCurrent()) return;
                if (updated?.id !== target.id || typeof updated.username !== "string" || updated.is_superuser !== true) {
                    throw new Error("Resposta inesperada à promoção.");
                }
                setList(({ users, error }) => ({ users: users.map((user) => user.id === target.id ? updated : user), error }));
                setNotice({ text: `Conta de ${updated.username} promovida a superusuário.` });
            } else {
                await deleteAdminUser(target.id, { signal });
                if (!isCurrent()) return;
                setList(({ users, error }) => ({ users: users.filter((user) => user.id !== target.id), error }));
                setNotice({ text: `Conta de ${target.username} excluída.` });
            }
            setConfirmation(null);
        } catch (error) {
            if (!isCurrent()) return;
            if (isAccessDenied(error.status)) {
                onAccessDenied(error.status);
                return;
            }
            if (error.status === 404 || error.status === 409) {
                setNotice({ error: true, text: error.status === 404
                    ? `A conta de ${target.username} não foi encontrada. Atualizando a lista.`
                    : promoting
                        ? `Não foi possível promover a conta de ${target.username} por um conflito.`
                        : `Não foi possível excluir a conta de ${target.username} por um conflito. Você não pode excluir a própria conta.` });
                setConfirmation(null);
                reloadUsers();
            } else {
                setNotice({ error: true, text: `Não foi possível ${promoting ? "promover" : "excluir"} a conta de ${target.username}. Tente novamente.` });
            }
        } finally {
            activeMutation.current = null;
            if (isCurrent()) setPending(false);
        }
    }

    return (
        <section className="panel-surface admin-users" aria-labelledby={headingId}>
            <div className="admin-users-heading">
                <div>
                    <p className="eyebrow">Diretório</p>
                    <h2 id={headingId}>Gerenciar usuários</h2>
                </div>
                {list.users && <span className="panel-count">{list.users.length} {list.users.length === 1 ? "conta" : "contas"}</span>}
            </div>
            {notice && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
            {list.error ? (
                <div>
                    <p role="alert">{list.error}</p>
                    <button className="button-secondary" type="button" onClick={reloadUsers}>Tentar novamente</button>
                </div>
            ) : !list.users ? (
                <p role="status">Carregando usuários...</p>
            ) : list.users.length === 0 ? (
                <p>Nenhum usuário encontrado.</p>
            ) : (
                <ul className="admin-users-list">
                    {list.users.map((user) => {
                        const isOwn = user.id === viewerId;
                        const action = confirmation?.id === user.id ? confirmation.action : null;
                        const promoting = action === "promote";
                        return (
                            <li key={user.id}>
                                <div className="admin-user-row">
                                    <div className="admin-user-meta">
                                        <div><strong>{user.username}</strong>{isOwn && " (você)"}</div>
                                        <span className={`admin-user-role${user.is_superuser ? " is-superuser" : ""}`}>
                                            {user.is_superuser ? "Superusuário" : "Usuário comum"}
                                        </span>
                                    </div>
                                    {!isOwn && !action && (
                                        <div className="admin-delete-actions">
                                            {!user.is_superuser && (
                                                <button className="button-secondary admin-cancel-button" type="button" disabled={pending}
                                                    aria-label={`Promover ${user.username} a superusuário`}
                                                    onClick={() => askConfirmation(user.id, "promote")}>
                                                    Promover a superusuário
                                                </button>
                                            )}
                                            <button className="admin-delete-button" type="button" disabled={pending}
                                                aria-label={`Excluir conta de ${user.username}`}
                                                onClick={() => askConfirmation(user.id, "delete")}>
                                                Excluir conta
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {!isOwn && action && (
                                    <div className={`admin-delete-confirmation${promoting ? " is-promoting" : ""}`}>
                                        <p id={warningId}>
                                            {promoting ? (
                                                <>Promover <strong>{user.username}</strong> a superusuário? A conta poderá moderar resenhas, promover usuários e excluir outras contas.</>
                                            ) : (
                                                <>Excluir a conta de <strong>{user.username}</strong>{user.is_superuser && " (Superusuário)"}? A conta, as resenhas (notas e textos) e os registros de filmes favoritos e assistidos serão apagados permanentemente, além da lista Desejo assistir. Esta ação não pode ser desfeita.</>
                                            )}
                                        </p>
                                        <div className="admin-delete-actions">
                                            <button className="button-secondary admin-cancel-button" type="button" autoFocus disabled={pending}
                                                onClick={() => { setConfirmation(null); setNotice(null); }}>
                                                Cancelar
                                            </button>
                                            <button className={promoting ? "button-primary" : "admin-delete-button"} type="button" disabled={pending}
                                                aria-describedby={warningId} onClick={() => confirmAction(user.id, action)}>
                                                {promoting ? "Confirmar promoção" : "Confirmar exclusão"}
                                            </button>
                                        </div>
                                        {pending && <p role="status">{promoting ? "Promovendo" : "Excluindo"} a conta de {user.username}...</p>}
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
