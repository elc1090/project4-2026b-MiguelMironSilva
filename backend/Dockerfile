FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SQLITE_DB_PATH=/data/sqlite/webapp_filmes.db

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Um novo volume nomeado copia este subdiretório gravável da imagem.
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --no-create-home app \
    && install -d -o app -g app -m 0750 /data/sqlite

COPY alembic.ini .
COPY alembic/ alembic/
COPY app/ app/
COPY --chmod=755 entrypoint.sh /usr/local/bin/backend-entrypoint

USER app
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/backend-entrypoint"]
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
