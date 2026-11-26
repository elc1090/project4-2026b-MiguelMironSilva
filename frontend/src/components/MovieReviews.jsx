import { useEffect, useId, useRef, useState } from "react";
import {
    ApiConnectionError,
    createMovieReview,
    deleteMovieReview,
    getMovieReviews,
    getToken,
    summarizeMovieReviews,
    updateMovieReview,
} from "../services/api.js";

const TEXT_LIMIT = 2000;
const REVIEW_RATINGS = Array.from({ length: 10 }, (_, index) => index + 1);
const LOADING = { reviews: null, error: "" };
const ratingFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
});

export function ReviewDate({ value }) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "data não informada";
    return <time dateTime={value}>{dateFormatter.format(date)}</time>;
}

export function CommunityRating({ reviews }) {
    let sum = 0;
    let count = 0;
    for (const { rating } of reviews) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 10) continue;
        sum += rating;
        count += 1;
    }

    if (count === 0) return <p>Sem notas da comunidade.</p>;
    const average = Math.round((sum * 100) / count) / 100;
    return (
        <p>
            <strong>Nota da comunidade: {ratingFormatter.format(average)}/10</strong>
            {" · "}{count} {count === 1 ? "avaliação com nota" : "avaliações com nota"}
        </p>
    );
}

export function ReviewContent({ review }) {
    return (
        <>
            <h3>{review.author.username}</h3>
            {review.rating != null && <p className="movie-review-rating">Nota: {review.rating}/10</p>}
            <p className="movie-review-dates">
                Publicada em <ReviewDate value={review.created_at} />
                {review.updated_at && (
                    <> · Editada em <ReviewDate value={review.updated_at} /></>
                )}
            </p>
            {review.text != null && <p className="movie-review-text">{review.text}</p>}
        </>
    );
}

function reviewErrorMessage(error, operation) {
    switch (error.status) {
        case 401:
            return "Sua sessão expirou. Entre novamente para continuar.";
        case 403:
            return operation === "delete"
                ? "Você não tem permissão para excluir esta avaliação."
                : "Você não tem permissão para alterar esta avaliação.";
        case 404:
            return operation === "create"
                ? "Filme não encontrado para publicação da avaliação."
                : "A avaliação não está mais disponível.";
        case 409:
            return operation === "create"
                ? "Você já publicou uma avaliação para este filme. Edite a avaliação existente."
                : "A avaliação mudou. Confira a lista atualizada antes de tentar novamente.";
        default:
            return "Não foi possível concluir a operação. Tente novamente.";
    }
}

function summaryErrorMessage(error) {
    if (error instanceof ApiConnectionError) return error.message;
    switch (error.code) {
        case "gemini_configuration":
            return "O resumo por IA ainda não foi configurado no backend.";
        case "gemini_credentials":
            return "O Gemini não autorizou a solicitação. Verifique a chave de API no backend.";
        case "gemini_model":
            return "O modelo Gemini configurado não está disponível. Verifique a configuração do backend.";
        case "gemini_quota":
            return "O Gemini atingiu o limite de uso. Tente novamente mais tarde.";
        case "gemini_busy":
            return "O Gemini está sobrecarregado no momento. Tente novamente mais tarde.";
    }
    switch (error.status) {
        case 401:
            return "Sua sessão expirou. Entre novamente para gerar o resumo.";
        case 413:
            return "O volume de texto das resenhas excede o limite para gerar um resumo.";
        case 502:
        case 503:
            return "O serviço de resumo está indisponível no momento. Tente novamente mais tarde.";
        case 504:
            return "O serviço de resumo demorou a responder. Tente novamente.";
        default:
            return "Não foi possível gerar o resumo. Tente novamente.";
    }
}

function ReviewsForSession({ movieId, userId, isSuperuser, token, onLogin }) {
    const titleId = useId();
    const textId = useId();
    const ratingId = useId();
    const deleteWarningId = useId();
    const summaryTitleId = useId();
    const summaryDisclosureId = useId();
    const [list, setList] = useState(LOADING);
    const [summary, setSummary] = useState(null);
    const activeSummary = useRef(null);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [draft, setDraft] = useState("");
    const [ratingDraft, setRatingDraft] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    const [notice, setNotice] = useState(null);
    const [pending, setPending] = useState(null);
    const activeWrite = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        async function loadReviews() {
            try {
                const reviews = await getMovieReviews(movieId, { signal });
                if (signal.aborted) return;
                if (!Array.isArray(reviews)) throw new Error("Lista de resenhas inválida.");
                setList({ reviews, error: "" });
            } catch (error) {
                if (signal.aborted) return;
                setList({
                    reviews: null,
                    error: error.status === 404
                        ? "Filme não encontrado para consulta das resenhas."
                        : "Não foi possível carregar as resenhas.",
                });
            }
        }

        loadReviews();
        return () => controller.abort();
    }, [movieId, loadAttempt]);

    useEffect(() => () => {
        activeWrite.current?.abort();
        activeSummary.current?.abort();
    }, []);

    const ownReview = userId == null ? null : list.reviews?.find(
        (review) => review.author.id === userId,
    );
    const reviewSessionExpired = notice?.status === 401;
    const summarySessionExpired = summary?.status === 401;
    const sessionExpired = reviewSessionExpired || summarySessionExpired;
    const canSummarize = Boolean(token && list.reviews?.some(
        ({ text }) => typeof text === "string" && text.trim() !== "",
    ));
    const trimmed = draft.trim();
    const length = Array.from(trimmed).length;

    function invalidateSummary() {
        activeSummary.current?.abort();
        activeSummary.current = null;
        setSummary(null);
    }

    async function requestSummary() {
        if (!canSummarize || sessionExpired || token !== getToken() || activeSummary.current || activeWrite.current) return;
        const controller = new AbortController();
        const { signal } = controller;
        activeSummary.current = controller;
        const isCurrent = () => !signal.aborted && activeSummary.current === controller && getToken() === token;
        setSummary({ loading: true });

        try {
            const result = await summarizeMovieReviews(movieId, { signal });
            if (!isCurrent()) return;
            if (!result || (result.summary !== null && typeof result.summary !== "string") ||
                !Number.isInteger(result.review_count) || result.review_count < 0) {
                throw new Error("Resposta de resumo inválida.");
            }
            setSummary({ result });
        } catch (error) {
            if (isCurrent()) setSummary({ status: error.status, error: summaryErrorMessage(error) });
        } finally {
            if (activeSummary.current === controller) activeSummary.current = null;
        }
    }

    function retryList() {
        invalidateSummary();
        setList(LOADING);
        setLoadAttempt((attempt) => attempt + 1);
    }

    function resetForm() {
        setIsEditing(false);
        setDraft("");
        setRatingDraft("");
    }

    async function writeReview(operation, reviewId) {
        if (userId == null || sessionExpired || !list.reviews || activeWrite.current) return;
        const isDelete = operation === "delete";
        const deleteTarget = isDelete && list.reviews.find((review) => review.id === reviewId);
        const deletesOwnReview = isDelete && deleteTarget?.author.id === userId;
        if (isDelete) {
            if (!deleteTarget || reviewId !== deleteTargetId || (!deletesOwnReview && !isSuperuser)) return;
        } else if (operation === "create" ? ownReview : !ownReview) {
            return;
        }
        if (!isDelete && length > TEXT_LIMIT) {
            setNotice({ error: true, text: "A resenha pode ter até 2.000 caracteres." });
            return;
        }
        if (!isDelete && length === 0 && ratingDraft === "") {
            setNotice({ error: true, text: "Informe uma nota ou escreva uma resenha." });
            return;
        }

        const controller = new AbortController();
        const { signal } = controller;
        const token = getToken();
        const isCurrent = () => !signal.aborted && getToken() === token;
        activeWrite.current = controller;
        setPending(isDelete ? `Excluindo avaliação de ${deleteTarget.author.username}...` : "Salvando avaliação...");
        setNotice(null);

        try {
            if (isDelete) {
                await deleteMovieReview(movieId, reviewId, { signal });
                if (!isCurrent()) return;
                setList(({ reviews, error }) => ({
                    reviews: reviews.filter((review) => review.id !== reviewId), error,
                }));
                setDeleteTargetId(null);
            } else {
                const reviewData = {
                    text: trimmed || null,
                    rating: ratingDraft === "" ? null : Number(ratingDraft),
                };
                const saved = operation === "create"
                    ? await createMovieReview(movieId, reviewData, { signal })
                    : await updateMovieReview(movieId, ownReview.id, reviewData, { signal });
                if (!isCurrent()) return;
                setList(({ reviews, error }) => ({
                    reviews: operation === "create"
                        ? [saved, ...reviews]
                        : reviews.map((review) => review.id === ownReview.id ? saved : review),
                    error,
                }));
            }

            invalidateSummary();
            if (!isDelete || deletesOwnReview) resetForm();
            setNotice({ text: {
                create: "Avaliação publicada.",
                edit: "Avaliação atualizada.",
                delete: "Avaliação excluída.",
            }[operation] });
        } catch (error) {
            if (!isCurrent()) return;
            setNotice({ error: true, status: error.status, text: reviewErrorMessage(error, operation) });
            if ([401, 403, 404, 409].includes(error.status)) setDeleteTargetId(null);
            if (error.status === 401) invalidateSummary();
            if ([403, 404, 409].includes(error.status)) {
                if (!isDelete || deletesOwnReview) resetForm();
                retryList();
            }
        } finally {
            if (activeWrite.current === controller) {
                activeWrite.current = null;
                if (!signal.aborted) setPending(null);
            }
        }
    }

    const canWrite = userId != null && !sessionExpired;
    const showForm = list.reviews && canWrite && (!ownReview || isEditing);

    return (
        <section className="movie-reviews" aria-labelledby={titleId}>
            <header className="movie-detail-section-heading movie-detail-reviews-heading">
                <div>
                    <p className="eyebrow">Comunidade</p>
                    <h2 id={titleId}>Resenhas e avaliações</h2>
                </div>
                {list.reviews && (
                    <div className="movie-detail-community-rating">
                        <CommunityRating reviews={list.reviews} />
                    </div>
                )}
            </header>
            {canSummarize && !reviewSessionExpired && (
                <section className="movie-review-summary" aria-labelledby={summaryTitleId}>
                    <h3 id={summaryTitleId}>Resumo das resenhas</h3>
                    {!summarySessionExpired && (
                        <>
                            <p id={summaryDisclosureId}>
                                Ao solicitar um resumo, os textos públicos das resenhas deste filme serão enviados ao Google.
                            </p>
                            <div className="movie-review-actions">
                                <button type="button" className="button-secondary" aria-describedby={summaryDisclosureId}
                                    disabled={!!pending || !!summary?.loading} onClick={requestSummary}>
                                    Resumir resenhas com IA
                                </button>
                            </div>
                        </>
                    )}
                    <div aria-live="polite" aria-atomic="true">
                        {summary?.loading && <p>Gerando resumo...</p>}
                        {summary?.result && (
                            <>
                                {summary.result.summary?.trim() ? (
                                    <>
                                        <p><strong>Resumo gerado por IA</strong></p>
                                        <p className="movie-review-text">{summary.result.summary}</p>
                                    </>
                                ) : <p>Nenhum resumo disponível para as resenhas deste filme.</p>}
                                <p>Resenhas consideradas: {summary.result.review_count}</p>
                            </>
                        )}
                    </div>
                    {summary?.error && (
                        <div>
                            <p role="alert">{summary.error}</p>
                            {summarySessionExpired && onLogin && (
                                <button type="button" className="button-secondary" onClick={onLogin}>Entrar novamente</button>
                            )}
                        </div>
                    )}
                </section>
            )}
            {userId == null && (
                <div className="movie-detail-review-callout">
                    <p>Entre para avaliar ou escrever uma resenha sobre este filme.</p>
                    {onLogin && <button type="button" className="button-primary" onClick={onLogin}>Fazer login</button>}
                </div>
            )}
            {notice && (
                <p className="movie-detail-review-notice" role={notice.error ? "alert" : "status"}>
                    {notice.text}
                    {reviewSessionExpired && onLogin && (
                        <> <button type="button" className="button-secondary" onClick={onLogin}>Entrar novamente</button></>
                    )}
                </p>
            )}
            {pending && <p className="movie-detail-review-notice" role="status">{pending}</p>}
            {list.error ? (
                <div className="movie-detail-review-callout">
                    <p role="alert">{list.error}</p>
                    <button type="button" className="button-secondary" onClick={retryList}>Tentar novamente</button>
                </div>
            ) : !list.reviews ? (
                <p className="movie-detail-review-notice" role="status">Carregando resenhas...</p>
            ) : list.reviews.length === 0 ? (
                <p className="movie-detail-review-notice">Nenhuma avaliação publicada.</p>
            ) : (
                <ul className="movie-review-list">
                    {list.reviews.map((review) => {
                        const isOwn = review.id === ownReview?.id;
                        const canEdit = canWrite && isOwn && !isEditing;
                        const canDelete = canWrite && (isOwn ? !isEditing : isSuperuser);
                        const confirmingDelete = canDelete && review.id === deleteTargetId;

                        return (
                            <li key={review.id}>
                                <article>
                                    <ReviewContent review={review} />
                                    {confirmingDelete ? (
                                        <div className="movie-review-actions movie-detail-delete-confirmation">
                                            <p id={deleteWarningId}>
                                                Excluir a avaliação de <strong>{review.author.username}</strong>?
                                                A nota e o texto, se presentes, serão removidos. Esta ação não pode ser desfeita.
                                            </p>
                                            <button type="button" className="button-secondary movie-detail-danger" disabled={!!pending} aria-describedby={deleteWarningId}
                                                onClick={() => writeReview("delete", review.id)}>Confirmar exclusão</button>
                                            <button type="button" className="button-secondary" autoFocus disabled={!!pending} onClick={() => {
                                                setDeleteTargetId(null);
                                                setNotice(null);
                                            }}>Cancelar</button>
                                        </div>
                                    ) : (canEdit || canDelete) && (
                                        <div className="movie-review-actions">
                                            {canEdit && (
                                                <button type="button" className="button-secondary" disabled={!!pending} onClick={() => {
                                                    setDraft(review.text ?? "");
                                                    setRatingDraft(review.rating == null ? "" : String(review.rating));
                                                    setNotice(null);
                                                    setIsEditing(true);
                                                }}>Editar avaliação</button>
                                            )}
                                            {canDelete && (
                                                <button type="button" className="button-secondary" disabled={!!pending} onClick={() => {
                                                    setNotice(null);
                                                    setDeleteTargetId(review.id);
                                                }}>{isOwn ? "Excluir avaliação" : "Excluir avaliação (moderação)"}</button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            </li>
                        );
                    })}
                </ul>
            )}
            {showForm && (
                <form className="movie-review-form" onSubmit={(event) => {
                    event.preventDefault();
                    writeReview(ownReview ? "edit" : "create");
                }}>
                    <h3>{ownReview ? "Editar avaliação" : "Sua avaliação"}</h3>
                    <label htmlFor={ratingId}>Sua avaliação (opcional)</label>
                    <select id={ratingId} value={ratingDraft} disabled={!!pending}
                        onChange={(event) => setRatingDraft(event.target.value)}>
                        <option value="">Sem nota</option>
                        {REVIEW_RATINGS.map((rating) => (
                            <option key={rating} value={rating}>{rating}/10</option>
                        ))}
                    </select>
                    <label htmlFor={textId}>{ownReview ? "Editar sua resenha (opcional)" : "Escreva sua resenha (opcional)"}</label>
                    <textarea id={textId} rows={5} value={draft} autoFocus={!!ownReview} disabled={!!pending}
                        aria-describedby={`${textId}-limit`}
                        onChange={(event) => setDraft(event.target.value)} />
                    <p id={`${textId}-limit`}>{length} / {TEXT_LIMIT} caracteres. Informe uma nota, uma resenha ou ambas; uma avaliação por filme.</p>
                    <div className="movie-review-actions">
                        <button type="submit" className="button-primary" disabled={!!pending}>
                            {ownReview ? "Salvar edição" : "Publicar avaliação"}
                        </button>
                        {ownReview && (
                            <button type="button" className="button-secondary" disabled={!!pending} onClick={() => {
                                resetForm();
                                setNotice(null);
                            }}>Cancelar edição</button>
                        )}
                    </div>
                </form>
            )}
        </section>
    );
}

export default function MovieReviews({ movieId, currentUser, onLogin }) {
    // Descarte rascunhos, alterações e resumos antigos quando o filme ou o escopo da sessão mudar.
    if (!movieId) return null;
    const userId = currentUser?.id;
    const isSuperuser = currentUser?.is_superuser === true;
    const token = userId != null && typeof sessionStorage !== "undefined" ? getToken() : null;
    const scope = JSON.stringify([movieId, userId, isSuperuser, token]);
    return <ReviewsForSession key={scope} movieId={movieId} userId={userId}
        isSuperuser={isSuperuser} token={token} onLogin={onLogin} />;
}
