export const API_BASE_URL =
import.meta.env?.VITE_API_BASE_URL ||
"http://127.0.0.1:8000/api";

// ============================================================
// ARMAZENAMENTO DE TOKENS
// ============================================================

const TOKEN_KEY = "access_token";

export const getToken = () => {
return sessionStorage.getItem(TOKEN_KEY);
};

export const setToken = (token) => {
sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
sessionStorage.removeItem(TOKEN_KEY);
};

// ============================================================
// HELPERS DE REQUEST
// ============================================================

const getAuthHeaders = (token = getToken()) => {
if (!token) {
    return {};
}

return {
    Authorization: `Bearer ${token}`,
};


};

const parseResponse = async (response) => {
const contentType =
response.headers.get("content-type") || "";


let data = null;

if (contentType.includes("application/json")) {
    data = await response.json();
} else {
    data = await response.text();
}

if (!response.ok) {
    const message =
        typeof data === "object" && data?.detail
            ? Array.isArray(data.detail)
                ? data.detail
                    .map(error => error.msg)
                    .join(", ")
                : data.detail
            : `Request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    throw error;
}

return data;


};

// ============================================================
// AUTENTICAÇÃO
// ============================================================

export const register = async (
username,
email,
password
) => {
const response = await fetch(
`${API_BASE_URL}/auth/register`,
{
method: "POST",


        headers: {
            "Content-Type": "application/json",
        },

        body: JSON.stringify({
            username,
            email,
            password,
        }),
    }
);

return parseResponse(response);


};

export const login = async (
username,
password
) => {
const formData = new URLSearchParams();


formData.append(
    "grant_type",
    "password"
);

formData.append(
    "username",
    username
);

formData.append(
    "password",
    password
);

const response = await fetch(
    `${API_BASE_URL}/auth/login`,
    {
        method: "POST",

        headers: {
            "Content-Type":
                "application/x-www-form-urlencoded",
        },

        body: formData,
    }
);

const data = await parseResponse(response);

setToken(data.access_token);

return data;

};

export const getGoogleSignInStatus = async ({ signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/auth/google/status`, { signal });
    return parseResponse(response);
};

export const exchangeGoogleCode = async (code, verifier) => {
    const response = await fetch(`${API_BASE_URL}/auth/google/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, verifier }),
    });
    return parseResponse(response);
};

export const getCurrentUser = async ({ token } = {}) => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeaders(token) });
    return parseResponse(response);
};

export const deleteCurrentUser = async (password, { signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "DELETE",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal,
    });
    if (response.status === 204) return;
    // This mutation's outcome is defined by its status, not an optional body.
    const error = new Error("Não foi possível excluir a conta.");
    error.status = response.status;
    throw error;
};

export const getAdminIdentity = async ({ signal } = {}) => {
const response = await fetch(`${API_BASE_URL}/admin/me`, {
    headers: getAuthHeaders(),
    signal,
});
return parseResponse(response);
};

const adminUsersUrl = `${API_BASE_URL}/admin/users`;

export const getAdminUsers = async ({ signal } = {}) => {
    const response = await fetch(adminUsersUrl, { headers: getAuthHeaders(), signal });
    return parseResponse(response);
};

export const promoteAdminUser = async (userId, { signal } = {}) => {
    const response = await fetch(`${adminUsersUrl}/${encodeURIComponent(userId)}/promote`, {
        method: "POST",
        headers: getAuthHeaders(),
        signal,
    });
    return parseResponse(response);
};

export const deleteAdminUser = async (userId, { signal } = {}) => {
    const response = await fetch(`${adminUsersUrl}/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        signal,
    });
    if (response.status === 204) return;
    if (!response.ok) await parseResponse(response);
    throw new Error("Resposta inesperada ao excluir a conta.");
};

export const logout = () => {
clearToken();
};

// ============================================================
// FILMES
// ============================================================

export const searchMovies = async (query) => {
const response = await fetch(
`${API_BASE_URL}/movies/search?query=${encodeURIComponent(query)}`
);


return parseResponse(response);


};

export const getMovie = async (tmdbId, { signal } = {}) => {
const response = await fetch(
`${API_BASE_URL}/movies/${encodeURIComponent(tmdbId)}`,
{ signal }
);


return parseResponse(response);


};

export const getMovieCredits = async (tmdbId) => {
const response = await fetch(
`${API_BASE_URL}/movies/${encodeURIComponent(tmdbId)}/credits`
);


return parseResponse(response);


};

// ============================================================
// RESENHAS DE FILMES
// ============================================================

export const getMyReviews = async ({ signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/reviews/mine`, {
        headers: getAuthHeaders(),
        signal,
    });
    return parseResponse(response);
};

const movieReviewsUrl = (tmdbId) =>
    `${API_BASE_URL}/movies/${encodeURIComponent(tmdbId)}/reviews`;

export const getMovieReviews = async (tmdbId, { signal } = {}) => {
    const response = await fetch(movieReviewsUrl(tmdbId), { signal });
    return parseResponse(response);
};

export const summarizeMovieReviews = async (tmdbId, { signal } = {}) => {
    const response = await fetch(`${movieReviewsUrl(tmdbId)}/summary`, {
        method: "POST",
        headers: getAuthHeaders(),
        signal,
    });
    return parseResponse(response);
};

const writeMovieReview = async (url, method, review, signal) => {
    const headers = getAuthHeaders();
    if (review !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(url, {
        method,
        headers,
        signal,
        body: review === undefined ? undefined : JSON.stringify(review),
    });
    if (method === "DELETE" && response.status === 204) return;
    return parseResponse(response);
};

export const createMovieReview = (tmdbId, review, { signal } = {}) =>
    writeMovieReview(movieReviewsUrl(tmdbId), "POST", review, signal);

export const updateMovieReview = (tmdbId, reviewId, review, { signal } = {}) =>
    writeMovieReview(`${movieReviewsUrl(tmdbId)}/${encodeURIComponent(reviewId)}`, "PATCH", review, signal);

export const deleteMovieReview = (tmdbId, reviewId, { signal } = {}) =>
    writeMovieReview(`${movieReviewsUrl(tmdbId)}/${encodeURIComponent(reviewId)}`, "DELETE", undefined, signal);

// ============================================================
// ESTADO DO FILME DO USUÁRIO
// ============================================================

const movieStateUrl = (tmdbId) =>
    `${API_BASE_URL}/my-movies/${encodeURIComponent(tmdbId)}`;

export const getMovieState = async (tmdbId, { signal } = {}) => {
    const response = await fetch(movieStateUrl(tmdbId), { headers: getAuthHeaders(), signal });
    return parseResponse(response);
};

export const updateMovieState = async (tmdbId, changes, { signal } = {}) => {
    const response = await fetch(movieStateUrl(tmdbId), {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(changes),
        signal,
    });
    return parseResponse(response);
};

export const deleteMovieState = async (tmdbId) => {
const response = await fetch(
`${API_BASE_URL}/my-movies/${encodeURIComponent(tmdbId)}`,
{
method: "DELETE",


        headers: {
            ...getAuthHeaders(),
        },
    }
);

return parseResponse(response);


};

export const getMyMovies = async ({ signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/my-movies/`, {
        headers: getAuthHeaders(),
        signal,
    });
    return parseResponse(response);
};
