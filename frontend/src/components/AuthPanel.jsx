import { useEffect, useState } from "react";
import { getGoogleSignInStatus } from "../services/api.js";
import { startGoogleSignIn } from "../services/googleAuth.js";

function PasswordField({ id, label, onValueChange, error, ...inputProps }) {
    const [isVisible, setIsVisible] = useState(false);
    const action = isVisible ? "Ocultar" : "Mostrar";
    const errorId = `${id}-error`;

    return (
        <div className="auth-field">
            <label htmlFor={id}>{label}</label>
            <div className="auth-password-control">
                <input
                    {...inputProps}
                    id={id}
                    type={isVisible ? "text" : "password"}
                    onChange={(event) => onValueChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    required
                />
                <button
                    type="button"
                    className="auth-password-toggle"
                    aria-controls={id}
                    aria-label={`${action} ${label.toLowerCase()}`}
                    onClick={() => setIsVisible((visible) => !visible)}
                >
                    {action}
                </button>
            </div>
            {error && <p id={errorId} className="auth-message" role="alert">{error}</p>}
        </div>
    );
}

function AuthPanel({
onLogin,
onRegister,
}) {
const [mode, setMode] = useState("login");


const [loginUsername, setLoginUsername] = useState("");
const [loginPassword, setLoginPassword] = useState("");

const [registerUsername, setRegisterUsername] = useState("");
const [registerEmail, setRegisterEmail] = useState("");
const [registerPassword, setRegisterPassword] = useState("");
const [registerPasswordConfirmation, setRegisterPasswordConfirmation] = useState("");
const [passwordMismatch, setPasswordMismatch] = useState(false);

const [message, setMessage] = useState("");
const [isSubmitting, setIsSubmitting] = useState(false);
const [googleEnabled, setGoogleEnabled] = useState(false);
const [isStartingGoogle, setIsStartingGoogle] = useState(false);
const [googleError, setGoogleError] = useState("");
const isBusy = isSubmitting || isStartingGoogle;

useEffect(() => {
    const controller = new AbortController();
    getGoogleSignInStatus({ signal: controller.signal })
        .then((status) => {
            if (!controller.signal.aborted) setGoogleEnabled(status?.enabled === true);
        })
        .catch(() => { /* Google sign-in is optional; local auth stays available. */ });
    const onPageShow = (event) => {
        if (event.persisted) setIsStartingGoogle(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
        controller.abort();
        window.removeEventListener("pageshow", onPageShow);
    };
}, []);

const handleGoogleSignIn = async () => {
    if (isBusy) return;
    setGoogleError("");
    setMessage("");
    setIsStartingGoogle(true);
    try {
        await startGoogleSignIn();
    } catch {
        setGoogleError("Não foi possível iniciar o login com Google. Verifique se a página está em uma conexão segura e tente novamente.");
        setIsStartingGoogle(false);
    }
};

const switchToLogin = () => {
    setMode("login");
    setMessage("");
    setPasswordMismatch(false);
};


const switchToRegister = () => {
    setMode("register");
    setMessage("");
};


const handleLogin = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    setMessage("");
    setIsSubmitting(true);

    try {
        await onLogin(
            loginUsername.trim(),
            loginPassword
        );

        setLoginPassword("");
        setMessage("");

    } catch (error) {
        setMessage(
            error.message || "Falha ao fazer login."
        );

    } finally {
        setIsSubmitting(false);
    }
};


const handleRegister = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    setMessage("");
    if (registerPassword !== registerPasswordConfirmation) {
        setPasswordMismatch(true);
        return;
    }

    setPasswordMismatch(false);
    setIsSubmitting(true);

    try {
        await onRegister(
            registerUsername.trim(),
            registerEmail.trim(),
            registerPassword
        );

        setLoginUsername(
            registerUsername.trim()
        );

        setRegisterUsername("");
        setRegisterEmail("");
        setRegisterPassword("");
        setRegisterPasswordConfirmation("");

        setMode("login");

        setMessage(
            "Cadastro realizado. Faça login para continuar."
        );

    } catch (error) {
        setMessage(
            error.message ||
            "Falha ao criar a conta."
        );

    } finally {
        setIsSubmitting(false);
    }
};


return (
    <section className="auth-panel">

        <div className="auth-panel-content">

            <div className="auth-tabs">

                <button
                    type="button"
                    className={
                        mode === "login"
                            ? "active"
                            : ""
                    }
                    onClick={switchToLogin}
                    disabled={isBusy}
                >
                    Login
                </button>

                <button
                    type="button"
                    className={
                        mode === "register"
                            ? "active"
                            : ""
                    }
                    onClick={switchToRegister}
                    disabled={isBusy}
                >
                    Novo Usuario
                </button>

            </div>


            {mode === "login" ? (
                <form key="login" onSubmit={handleLogin}>

                    <div className="auth-field">

                        <label htmlFor="login-username">
                            Nome de Usuario ou Email
                        </label>

                        <input
                            id="login-username"
                            type="text"
                            autoComplete="username"
                            value={loginUsername}
                            onChange={(event) =>
                                setLoginUsername(
                                    event.target.value
                                )
                            }
                            required
                        />

                    </div>


                    <PasswordField
                        id="login-password"
                        label="Senha"
                        autoComplete="current-password"
                        value={loginPassword}
                        onValueChange={setLoginPassword}
                    />


                    <button
                        type="submit"
                        disabled={isBusy}
                    >
                        {isSubmitting
                            ? "Entrando..."
                            : "Login"}
                    </button>

                </form>

            ) : (

                <form key="register" onSubmit={handleRegister}>

                    <div className="auth-field">

                        <label htmlFor="register-username">
                            Nome de Usuario
                        </label>

                        <input
                            id="register-username"
                            type="text"
                            autoComplete="username"
                            minLength={3}
                            maxLength={30}
                            value={registerUsername}
                            onChange={(event) =>
                                setRegisterUsername(
                                    event.target.value
                                )
                            }
                            required
                        />

                    </div>


                    <div className="auth-field">

                        <label htmlFor="register-email">
                            Email
                        </label>

                        <input
                            id="register-email"
                            type="email"
                            autoComplete="email"
                            value={registerEmail}
                            onChange={(event) =>
                                setRegisterEmail(
                                    event.target.value
                                )
                            }
                            required
                        />

                    </div>


                    <PasswordField
                        id="register-password"
                        label="Senha"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={registerPassword}
                        onValueChange={(value) => {
                            setRegisterPassword(value);
                            setPasswordMismatch(false);
                        }}
                    />

                    <PasswordField
                        id="register-password-confirmation"
                        label="Confirmação de senha"
                        autoComplete="new-password"
                        value={registerPasswordConfirmation}
                        onValueChange={(value) => {
                            setRegisterPasswordConfirmation(value);
                            setPasswordMismatch(false);
                        }}
                        error={passwordMismatch ? "As senhas não coincidem." : undefined}
                    />


                    <button
                        type="submit"
                        disabled={isBusy}
                    >
                        {isSubmitting
                            ? "Criando..."
                            : "Novo Usuario"}
                    </button>

                </form>
            )}


            {googleEnabled && (
                <button type="button" disabled={isBusy} onClick={handleGoogleSignIn}>
                    {isStartingGoogle ? "Redirecionando…" : "Continuar com Google"}
                </button>
            )}
            {googleError && <p className="auth-message" role="alert">{googleError}</p>}

            {message && (
                <p className="auth-message">
                    {message}
                </p>
            )}

        </div>

    </section>
);


}

export default AuthPanel;
