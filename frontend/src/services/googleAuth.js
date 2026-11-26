import { API_BASE_URL, exchangeGoogleCode, getCurrentUser } from "./api.js";

const VERIFIER_KEY = "google_sign_in_verifier";
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;
const GOOGLE_ERRORS = new Map([
    ["disabled", "O login com Google está indisponível. Você pode entrar com sua senha."],
    ["cancelled", "O login com Google foi cancelado."],
    ["invalid", "Não foi possível validar o login com Google. Inicie o login novamente."],
    ["failed", "Não foi possível entrar com Google. Tente novamente."],
    ["email_conflict", "Já existe uma conta com este e-mail. Entre com sua senha."],
]);

export const googleSignInError = (error) => GOOGLE_ERRORS.get(error) ?? GOOGLE_ERRORS.get("failed");

const base64url = (bytes) => btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

export async function startGoogleSignIn(browser = window) {
    // No insecure fallback: the verifier must be random and its challenge must be SHA-256.
    const crypto = browser.crypto;
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = base64url(new Uint8Array(digest));
    const storage = browser.sessionStorage;
    storage.setItem(VERIFIER_KEY, verifier);
    try {
        browser.location.assign(`${API_BASE_URL}/auth/google?challenge=${challenge}`);
    } catch (error) {
        storage.removeItem(VERIFIER_KEY);
        throw error;
    }
}

//Execute antes da renderização. Remova fragmentos OAuth reconhecidos, mesmo quando não houver login pendente.
export function takeGoogleCallback(browser = window) {
    const { location, history } = browser;
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("google_code") && !params.has("google_error")) return null;
    history.replaceState(history.state, "", location.pathname + location.search);

    let verifier;
    try {
        const storage = browser.sessionStorage;
        verifier = storage.getItem(VERIFIER_KEY);
        if (verifier !== null) storage.removeItem(VERIFIER_KEY);
    } catch {
        return null;
    }
    if (!BASE64URL_32_BYTES.test(verifier ?? "")) return null;

    const code = params.get("google_code");
    if (params.size === 1 && params.has("google_error")) {
        const error = params.get("google_error");
        return { error: GOOGLE_ERRORS.has(error) ? error : "invalid" };
    }
    if (params.size !== 1 || !BASE64URL_32_BYTES.test(code ?? "")) return { error: "invalid" };

    let result;
    return {
        //Compartilhe um único resultado em andamento entre as reexecuções de um *effect* no React. Apenas o componente `App` pode efetivar esse resultado.
        complete: () => result ??= completeGoogleSignIn(code, verifier),
    };
}

async function completeGoogleSignIn(code, verifier) {
    const result = await exchangeGoogleCode(code, verifier);
    const token = result?.access_token;
    if (typeof token !== "string" || token.length === 0) throw new Error("Invalid token response");
    //Verifique a sessão retornada sem sobrescrever um token de portador (bearer token) existente.
    const user = await getCurrentUser({ token });
    return { token, user };
}
