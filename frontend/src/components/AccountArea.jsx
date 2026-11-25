import { useEffect, useId, useRef, useState } from "react";

const deleteErrors = {
    403: "Senha atual incorreta. Digite a senha novamente.",
    409: "Você é o último superusuário. Promova outro usuário a superusuário antes de excluir sua conta.",
    503: "A exclusão de contas está temporariamente indisponível. Tente novamente mais tarde.",
};

function FirstAdminCard({ phase, error, busy, onClaim }) {
    const titleId = useId();
    const instructionsId = useId();
    const inputId = useId();
    const errorId = useId();
    const codeRef = useRef(null);
    const submittingRef = useRef(false);
    const [code, setCode] = useState("");
    const submitting = phase === "submitting";
    const disabled = submitting || busy;

    useEffect(() => {
        if (error) codeRef.current?.focus();
    }, [error]);

    async function submit(event) {
        event.preventDefault();
        if (disabled || submittingRef.current || code.trim() === "") return;
        submittingRef.current = true;
        setCode("");
        try {
            await onClaim(code);
        } finally {
            submittingRef.current = false;
        }
    }

    return (
        <section className="panel-surface panel-first-admin" aria-labelledby={titleId}>
            <p className="eyebrow">Administração</p>
            <h2 id={titleId}>Configurar primeiro superusuário</h2>
            <p id={instructionsId}>Se você é responsável pela instalação, digite o código de configuração. Ele só pode ser usado uma vez e habilita a administração para esta conta.</p>
            <form className="first-admin-form" onSubmit={submit} aria-describedby={instructionsId}>
                <div>
                    <label htmlFor={inputId}>Código de configuração</label>
                    <input id={inputId} ref={codeRef} name="first-admin-code" type="password"
                        autoComplete="off" autoCapitalize="none" spellCheck={false} required
                        value={code} onChange={(event) => setCode(event.target.value)} disabled={disabled}
                        aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} />
                </div>
                {error && <p id={errorId} role="alert">{error}</p>}
                <button type="submit" className="button-primary" disabled={disabled || code.trim() === ""}>
                    Ativar acesso à administração
                </button>
                {submitting && <p role="status">Confirmando a configuração inicial…</p>}
            </form>
        </section>
    );
}

export default function AccountArea({ user, pending, error, onClearError, onDelete, onBack, onPassword,
    firstAdmin, onClaimFirstAdmin, onFirstAdminRelogin, onFirstAdminOpen,
}) {
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
    const claimingFirstAdmin = firstAdmin?.phase === "submitting";
    const deletionBusy = pending || claimingFirstAdmin;

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
        if (user.has_password === false || !isConfirming || deletionBusy || password === "") return;
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
                        <>
                            <p>Sua conta usa o login com Google e não tem senha. {onPassword
                                ? "Defina uma senha para confirmar a exclusão da conta aqui. Se não conseguir acessar o Google, entre em contato com a administração."
                                : "Para solicitar a exclusão, entre em contato com a administração."}</p>
                            {onPassword && <button type="button" className="button-secondary" onClick={onPassword}>Definir senha</button>}
                        </>
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
                                disabled={deletionBusy}
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
                                        disabled={deletionBusy}
                                    />
                                    <div className="account-delete-actions">
                                        <button className="button-secondary account-cancel-button" type="button" disabled={deletionBusy} onClick={() => {
                                            restoreDeleteFocus.current = true;
                                            setIsConfirming(false);
                                            setPassword("");
                                            onClearError();
                                        }}>
                                            Cancelar
                                        </button>
                                        <button className="account-delete-button" type="submit" disabled={deletionBusy || password === ""}>
                                            Confirmar exclusão definitiva
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </section>
                {onClaimFirstAdmin && (firstAdmin?.phase === "available" || claimingFirstAdmin) && (
                    <FirstAdminCard phase={firstAdmin.phase} error={firstAdmin.error} busy={pending} onClaim={onClaimFirstAdmin} />
                )}
                {firstAdmin?.phase === "success" && user.is_superuser === true && (
                    <div className="panel-first-admin-feedback">
                        <p role="status">Seu acesso de superusuário foi ativado.</p>
                        {onFirstAdminOpen && <button type="button" className="button-secondary" onClick={onFirstAdminOpen}>Abrir Administração</button>}
                    </div>
                )}
                {firstAdmin?.phase === "closed" && (
                    <p className="panel-first-admin-feedback" role="status">O código expirou ou a configuração inicial já está encerrada.</p>
                )}
                {firstAdmin?.phase === "expired" && (
                    <div className="panel-first-admin-feedback">
                        <p role="alert">Sua sessão expirou. Entre novamente para configurar a administração.</p>
                        {onFirstAdminRelogin && <button type="button" className="button-secondary" onClick={onFirstAdminRelogin}>Entrar novamente</button>}
                    </div>
                )}
            </div>
        </main>
    );
}
