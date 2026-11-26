import { API_BASE_URL, requestGooglePasswordAuthorization } from "./api.js";

const PENDING_KEY = "google_password_pending";
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const MAX_PENDING_AGE = 10 * 60 * 1000;
const CALLBACK_ERRORS = new Map([
    ["reauth_required", "O Google não confirmou um novo login. Saia da sua conta Google em outra aba, volte a esta tela e tente novamente com a mesma conta Google. Não saia do Miguel Cinema."],
    ["wrong_account", "Entre com a mesma conta Google vinculada ao Miguel Cinema."],
    ["cancelled", "A confirmação com Google foi cancelada. Nenhuma senha foi definida."],
    ["invalid", "Não foi possível validar a confirmação. Tente novamente."],
    ["disabled", "A confirmação com Google está indisponível no momento."],
    ["failed", "Não foi possível confirmar sua conta Google. Tente novamente."],
]);

export function googlePasswordError(code) {
    return CALLBACK_ERRORS.get(code) ?? CALLBACK_ERRORS.get("failed");
}

const base64url = (bytes) => btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

async function fingerprint(crypto, value) {
    return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

export function clearPendingGooglePassword(browser = globalThis.window) {
    try {
        browser.sessionStorage.removeItem(PENDING_KEY);
    } catch { /* Se o armazenamento estiver bloqueado, também não será possível iniciar este fluxo. */ }
}

export async function startGooglePassword({ token, userId, signal, isCurrent }, browser = window) {
    const crypto = browser.crypto;
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const [challenge, owner] = await Promise.all([
        fingerprint(crypto, verifier), fingerprint(crypto, token),
    ]);
    if (!isCurrent()) return;
    clearPendingGooglePassword(browser);
    const response = await requestGooglePasswordAuthorization(challenge, { token, signal });
    if (!isCurrent()) return;

    // A API deve definir seu cookie próprio de retorno antes de redirecionar ao Google.
    // Nunca navegue para uma URL arbitrária retornada pelo endpoint.
    if (typeof response?.authorization_url !== "string") throw new Error("Invalid authorization URL");
    const expected = new URL(`${API_BASE_URL}/auth/google/password/authorize`, browser.location.href);
    const destination = new URL(response.authorization_url);
    if (destination.origin !== expected.origin || destination.pathname !== expected.pathname ||
        destination.username || destination.password || destination.hash ||
        destination.searchParams.size !== 1 || !SECRET.test(destination.searchParams.get("ticket") ?? "")) {
        throw new Error("Unexpected authorization URL");
    }

    const pending = JSON.stringify({ verifier, owner, userId: String(userId), created: Date.now() });
    browser.sessionStorage.setItem(PENDING_KEY, pending);
    try {
        browser.location.assign(destination.href);
    } catch (error) {
        if (browser.sessionStorage.getItem(PENDING_KEY) === pending) clearPendingGooglePassword(browser);
        throw error;
    }
}

// Este trecho processa somente o fluxo de definição da primeira senha. O login Google comum usa
// outro fragmento e outra chave de armazenamento PKCE.
export function takeGooglePasswordCallback(browser = window) {
    const { location, history, sessionStorage } = browser;
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("google_password_code") && !params.has("google_password_error")) return null;
    history.replaceState(history.state, "", location.pathname + location.search);

    let pending;
    try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        sessionStorage.removeItem(PENDING_KEY);
        pending = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!pending || !SECRET.test(pending.verifier ?? "") || !SECRET.test(pending.owner ?? "") ||
        typeof pending.userId !== "string" || !pending.userId || !Number.isFinite(pending.created) ||
        pending.created > Date.now() || Date.now() - pending.created > MAX_PENDING_AGE) return null;

    const code = params.get("google_password_code");
    const error = params.get("google_password_error");
    const callback = params.size === 1 && SECRET.test(code ?? "")
        ? { proof: { code, verifier: pending.verifier } }
        : { error: params.size === 1 && CALLBACK_ERRORS.has(error) ? error : "invalid" };

    return {
        ...callback,
        async ownsSession(token, userId) {
            if (!token || String(userId) !== pending.userId) return false;
            try {
                return await fingerprint(browser.crypto, token) === pending.owner;
            } catch {
                return false;
            }
        },
    };
}
