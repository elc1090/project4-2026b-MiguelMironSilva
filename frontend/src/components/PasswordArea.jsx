import { useEffect, useId, useRef, useState } from "react";

function PasswordControl({ id, description, visible, onToggle, disabled, ...inputProps }) {
    const action = visible ? "Ocultar" : "Mostrar";
    return (
        <div className="auth-password-control">
            <input {...inputProps} id={id} type={visible ? "text" : "password"} disabled={disabled} required />
            <button type="button" className="auth-password-toggle" aria-controls={id}
                aria-label={`${action} ${description}`} onClick={onToggle} disabled={disabled}>
                {action}
            </button>
        </div>
    );
}

export default function PasswordArea({
    user, googleConfirmed, pending, notice, onStartGoogle, onUpdatePassword, onAccount,
}) {
    const headingId = useId();
    const cardId = useId();
    const rulesId = useId();
    const validationId = useId();
    const currentId = useId();
    const newId = useId();
    const repeatId = useId();
    const headingRef = useRef(null);
    const newRef = useRef(null);
    const repeatRef = useRef(null);
    const currentRef = useRef(null);
    const submitLock = useRef(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [validation, setValidation] = useState(null);
    const [visibleFields, setVisibleFields] = useState({});
    const first = user.has_password === false;
    const needsGoogle = first && !googleConfirmed;

    useEffect(() => { headingRef.current?.focus(); }, []);

    function clearFields() {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmation("");
        setValidation(null);
        setVisibleFields({});
    }

    async function submit(event) {
        event.preventDefault();
        if (pending || submitLock.current || needsGoogle) return;
        const invalid = !first && currentPassword === ""
            ? { field: "current", message: "Informe a senha atual.", ref: currentRef }
            : Array.from(newPassword).length < 8 || Array.from(newPassword).length > 128
                ? { field: "new", message: "A nova senha deve ter de 8 a 128 caracteres.", ref: newRef }
                : newPassword !== confirmation
                    ? { field: "repeat", message: "A confirmação deve ser igual à nova senha.", ref: repeatRef }
                    : null;
        if (invalid) {
            setValidation({ field: invalid.field, message: invalid.message });
            invalid.ref.current?.focus();
            return;
        }
        submitLock.current = true;
        // Nenhuma das senhas permanece no estado do formulário ou no armazenamento do navegador após o envio.
        clearFields();
        try {
            await onUpdatePassword(first ? undefined : currentPassword, newPassword);
        } finally {
            submitLock.current = false;
        }
    }

    const edit = (setter) => (event) => { setValidation(null); setter(event.target.value); };
    const errorFor = (field) => validation?.field === field ? validationId : undefined;
    const visibilityFor = (field) => ({
        visible: Boolean(visibleFields[field]) && !pending,
        onToggle: () => setVisibleFields((fields) => ({ ...fields, [field]: !fields[field] })),
        disabled: Boolean(pending),
    });
    const status = pending === "google" ? "Iniciando a confirmação com Google…"
        : pending === "save" ? "Salvando a senha…"
        : notice?.kind === "success" ? notice.text : "";

    return (
        <main className="page-shell panel-page password-area" id="main-content" tabIndex={-1} aria-labelledby={headingId}>
            <div className="panel-page-header">
                <div>
                    <p className="eyebrow">Configurações / Segurança</p>
                    <h1 id={headingId} tabIndex={-1} ref={headingRef}>Senha</h1>
                    <p className="panel-intro">Gerencie a senha do Miguel Cinema sem alterar a sua conta Google.</p>
                </div>
                <button className="button-secondary panel-back" type="button" onClick={onAccount}>
                    <span aria-hidden="true" />Minha conta
                </button>
            </div>
            <section className="panel-surface password-card" aria-labelledby={cardId}>
                <h2 id={cardId}>{first ? "Definir senha" : "Alterar senha"}</h2>
                {needsGoogle ? (
                    <>
                        <p>Confirme sua identidade com a mesma conta Google vinculada. Depois, escolha uma senha que também poderá usar para entrar no Miguel Cinema e para confirmar a exclusão da conta.</p>
                        <button type="button" className="button-primary" onClick={onStartGoogle} disabled={Boolean(pending)}>
                            Confirmar com Google
                        </button>
                    </>
                ) : (
                    <>
                        {first && <p>Identidade confirmada com Google. Você tem até um minuto após a confirmação para salvar a senha do Miguel Cinema.</p>}
                        <form className="password-form" onSubmit={submit} noValidate>
                            {!first && (
                                <div>
                                    <label htmlFor={currentId}>Senha atual</label>
                                    <PasswordControl id={currentId} ref={currentRef} name="current-password"
                                        autoComplete="current-password" value={currentPassword} onChange={edit(setCurrentPassword)}
                                        description="senha atual" {...visibilityFor("current")}
                                        aria-invalid={Boolean(errorFor("current"))} aria-describedby={errorFor("current")} />
                                </div>
                            )}
                            <div>
                                <label htmlFor={newId}>Nova senha</label>
                                <PasswordControl id={newId} ref={newRef} name="new-password"
                                    autoComplete="new-password" value={newPassword} onChange={edit(setNewPassword)}
                                    description="nova senha" {...visibilityFor("new")} aria-invalid={Boolean(errorFor("new"))}
                                    aria-describedby={errorFor("new") ? `${rulesId} ${validationId}` : rulesId} />
                                <p className="password-field-hint" id={rulesId}>Use de 8 a 128 caracteres.</p>
                            </div>
                            <div>
                                <label htmlFor={repeatId}>Confirmar nova senha</label>
                                <PasswordControl id={repeatId} ref={repeatRef} name="confirm-password"
                                    autoComplete="new-password" value={confirmation} onChange={edit(setConfirmation)}
                                    description="confirmação da nova senha" {...visibilityFor("repeat")}
                                    aria-invalid={Boolean(errorFor("repeat"))} aria-describedby={errorFor("repeat")} />
                            </div>
                            {validation && <p id={validationId} role="alert">{validation.message}</p>}
                            <button type="submit" className="button-primary" disabled={Boolean(pending)}>
                                {first ? "Salvar senha" : "Atualizar senha"}
                            </button>
                        </form>
                    </>
                )}
                <p role="status" aria-live="polite">{status}</p>
                {!validation && notice?.kind === "error" && <p role="alert">{notice.text}</p>}
            </section>
        </main>
    );
}
