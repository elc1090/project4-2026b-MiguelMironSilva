#!/bin/sh
set -eu

# Faça a migração usar o mesmo caminho SQLite que a aplicação.
unset ALEMBIC_DATABASE_URL
python -m alembic upgrade head
exec "$@"
