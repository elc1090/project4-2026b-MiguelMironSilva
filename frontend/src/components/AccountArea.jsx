import { useEffect, useId, useRef, useState } from "react";

const deleteErrors = {
    403: "Senha atual incorreta. Digite a senha novamente.",
    409: "Você é o último superusuário. Promova outro usuário a superusuário antes de excluir sua conta.",
    503: "A exclusão de contas está temporariamente indisponível. Tente novamente mais tarde.",
};

export default function AccountArea({ user, pending, error, onClearError, onDelete, onBack }) {
    const headingId = useId();
    const dangerId = useId();
    const warningId = useId();
    const errorId = useId();
    const passwordId = useId();
    const headingRef = useRef(null);
    const errorRef = useRef(null);
    const passwordRef = useRef(null);
    const deleteButtonRef = useRef(null);
    const restoreDeleteFocus = useRef(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [password, setPassword] = useState("");

    useEffect(() => { headingRef.current?.focus(); }, []);
    useEffect(() => {
        if (isConfirming) passwordRef.current?.focus();
        else if (restoreDeleteFocus.current) {
            restoreDeleteFocus.current = false;
            deleteButtonRef.current?.focus();
        }
    }, [isConfirming]);
    useEffect(() => {
        if (error) {
            if (error === 403 && passwordRef.current) passwordRef.current.focus();
            else errorRef.current?.focus();
        }
    }, [error]);

    function submitDelete(event) {
        event.preventDefault();
        if (user.has_password === false || !isConfirming || pending || password === "") return;
        onDelete(password);
        setPassword("");
    }

    return (
        <main className="page-shell panel-page account-area" id="main-content" tabIndex={-1} aria-labelledby={headingId}>
            <div className="panel-page-header">
                <div>
                    <p className="eyebrow">Configurações / Perfil</p>
                    <h1 id={headingId} tabIndex={-1} ref={headingRef}>Minha conta</h1>
                    <p className="panel-intro">Consulte seu perfil e gerencie sua conta.</p>
                </div>
                <button className="button-secondary panel-back" type="button" onClick={onBack}>
                    <span aria-hidden="true" />Pesquisar
                </button>
            </div>
            <div className="panel-account-layout">
                <section className="panel-surface panel-profile" aria-label="Perfil">
                    <span className="panel-avatar" aria-hidden="true">{Array.from(user.username ?? "")[0]?.toUpperCase() || "?"}</span>
                    <div>
                        <p className="eyebrow">Perfil</p>
                        <h2>{user.username}</h2>
                        {user.email && <p>{user.email}</p>}
                    </div>
                </section>
                <section className="panel-surface account-card panel-danger" aria-labelledby={dangerId}>
                    <p className="eyebrow">Zona de risco</p>
                    <h2 id={dangerId}>Excluir minha conta</h2>
                    {user.has_password === false ? (
                        <p>Sua conta usa o login com Google e não tem senha. Para solicitar a exclusão, entre em contato com a administração.</p>
                    ) : (
                        <>
                            <p id={warningId}>
                                A conta de <strong>{user.username}</strong>, as suas resenhas (notas e textos) e os seus registros de filmes favoritos e assistidos serão excluídos permanentemente, não anonimizados.
                                Sua lista Desejo assistir também será apagada. Suas notas deixarão de contar na média da comunidade.
                                Essa ação não pode ser desfeita.
                            </p>
                            {pending && <p role="status">Excluindo sua conta…</p>}
                            {error && (
                                <p id={errorId} role="alert" ref={errorRef} tabIndex={-1}>
                                    {deleteErrors[error] ?? "Não foi possível excluir sua conta. Tente novamente."}
                                </p>
                            )}
                            <button
                                className="account-delete-button"
                                type="button"
                                ref={deleteButtonRef}
                                aria-describedby={warningId}
                                hidden={isConfirming}
                                disabled={pending}
                                onClick={() => { onClearError(); setIsConfirming(true); }}
                            >
                                Excluir minha conta
                            </button>
                            {isConfirming && (
                                <form className="account-delete-form" onSubmit={submitDelete} aria-describedby={warningId}>
                                    <label htmlFor={passwordId}>Senha atual</label>
                                    <input
                                        id={passwordId}
                                        ref={passwordRef}
                                        type="password"
                                        name="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(event) => { setPassword(event.target.value); onClearError(); }}
                                        aria-invalid={error === 403 ? true : undefined}
                                        aria-describedby={error === 403 ? errorId : undefined}
                                        required
                                        disabled={pending}
                                    />
                                    <div className="account-delete-actions">
                                        <button className="button-secondary account-cancel-button" type="button" disabled={pending} onClick={() => {
                                            restoreDeleteFocus.current = true;
                                            setIsConfirming(false);
                                            setPassword("");
                                            onClearError();
                                        }}>
                                            Cancelar
                                        </button>
                                        <button className="account-delete-button" type="submit" disabled={pending || password === ""}>
                                            Confirmar exclusão definitiva
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}
