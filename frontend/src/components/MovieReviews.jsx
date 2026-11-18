import { useEffect, useId, useRef, useState } from "react";
import {
    createMovieReview,
    deleteMovieReview,
    getMovieReviews,
    getToken,
    updateMovieReview,
} from "../services/api.js";

const TEXT_LIMIT = 2000;
const LOADING = { reviews: null, error: "" };
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
});

function ReviewDate({ value }) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "data não informada";
    return <time dateTime={value}>{dateFormatter.format(date)}</time>;
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

function ReviewsForSession({ movieId, userId, isSuperuser, onLogin }) {
    const titleId = useId();
    const textId = useId();
    const ratingId = useId();
    const deleteWarningId = useId();
    const [list, setList] = useState(LOADING);
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

    useEffect(() => () => activeWrite.current?.abort(), []);

    const ownReview = userId == null ? null : list.reviews?.find(
        (review) => review.author.id === userId,
    );
    const sessionExpired = notice?.status === 401;
    const trimmed = draft.trim();
    const length = Array.from(trimmed).length;

    function retryList() {
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
            <h2 id={titleId}>Resenhas e avaliações</h2>
            {userId == null && (
                <p>
                    Entre para avaliar ou escrever uma resenha sobre este filme.
                    {onLogin && <> <button type="button" onClick={onLogin}>Fazer login</button></>}
                </p>
            )}
            {notice && (
                <p role={notice.error ? "alert" : "status"}>
                    {notice.text}
                    {sessionExpired && onLogin && (
                        <> <button type="button" onClick={onLogin}>Entrar novamente</button></>
                    )}
                </p>
            )}
            {pending && <p role="status">{pending}</p>}
            {list.error ? (
                <div>
                    <p role="alert">{list.error}</p>
                    <button type="button" onClick={retryList}>Tentar novamente</button>
                </div>
            ) : !list.reviews ? (
                <p role="status">Carregando resenhas...</p>
            ) : list.reviews.length === 0 ? (
                <p>Nenhuma avaliação publicada.</p>
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
                                        <div className="movie-review-actions">
                                            <p id={deleteWarningId}>
                                                Excluir a avaliação de <strong>{review.author.username}</strong>?
                                                A nota e o texto, se presentes, serão removidos. Esta ação não pode ser desfeita.
                                            </p>
                                            <button type="button" disabled={!!pending} aria-describedby={deleteWarningId}
                                                onClick={() => writeReview("delete", review.id)}>Confirmar exclusão</button>
                                            <button type="button" autoFocus disabled={!!pending} onClick={() => {
                                                setDeleteTargetId(null);
                                                setNotice(null);
                                            }}>Cancelar</button>
                                        </div>
                                    ) : (canEdit || canDelete) && (
                                        <div className="movie-review-actions">
                                            {canEdit && (
                                                <button type="button" disabled={!!pending} onClick={() => {
                                                    setDraft(review.text ?? "");
                                                    setRatingDraft(review.rating == null ? "" : String(review.rating));
                                                    setNotice(null);
                                                    setIsEditing(true);
                                                }}>Editar avaliação</button>
                                            )}
                                            {canDelete && (
                                                <button type="button" disabled={!!pending} onClick={() => {
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
                    <label htmlFor={ratingId}>Sua avaliação (opcional)</label>
                    <select id={ratingId} value={ratingDraft} disabled={!!pending}
                        onChange={(event) => setRatingDraft(event.target.value)}>
                        <option value="">Sem nota</option>
                        {Array.from({ length: 11 }, (_, rating) => (
                            <option key={rating} value={rating}>{rating}/10</option>
                        ))}
                    </select>
                    <label htmlFor={textId}>{ownReview ? "Editar sua resenha (opcional)" : "Escreva sua resenha (opcional)"}</label>
                    <textarea id={textId} rows={5} value={draft} autoFocus={!!ownReview} disabled={!!pending}
                        aria-describedby={`${textId}-limit`}
                        onChange={(event) => setDraft(event.target.value)} />
                    <p id={`${textId}-limit`}>{length} / {TEXT_LIMIT} caracteres. Informe uma nota, uma resenha ou ambas; uma avaliação por filme.</p>
                    <div className="movie-review-actions">
                        <button type="submit" disabled={!!pending}>
                            {ownReview ? "Salvar edição" : "Publicar avaliação"}
                        </button>
                        {ownReview && (
                            <button type="button" disabled={!!pending} onClick={() => {
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
    // Discard old drafts, confirmations and mutations when the film or session scope changes.
    if (!movieId) return null;
    const userId = currentUser?.id;
    const isSuperuser = currentUser?.is_superuser === true;
    const scope = JSON.stringify([movieId, userId, isSuperuser]);
    return <ReviewsForSession key={scope} movieId={movieId} userId={userId}
        isSuperuser={isSuperuser} onLogin={onLogin} />;
}
