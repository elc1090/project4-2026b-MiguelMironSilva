// UI visibility only. The API remains the authority for every admin request.
export const canAccessAdmin = (user) => user?.is_superuser === true;

export const adminErrorMessage = (error) => {
    if (error?.status === 401) {
        return "401 — Sessão ausente ou expirada. Faça login novamente.";
    }
    if (error?.status === 403) {
        return "403 — Acesso negado. Esta área é exclusiva para superusuários.";
    }
    return error?.message || "Não foi possível confirmar o acesso administrativo.";
};
