#!/bin/sh
set -eu

# Make the migration use the same SQLite path as the application.
unset ALEMBIC_DATABASE_URL
python -m alembic upgrade head
exec "$@"
