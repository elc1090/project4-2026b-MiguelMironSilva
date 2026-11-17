import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.database import Base, DATABASE_URL
from app import models  # noqa: F401 - register all mapped tables

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
url = os.environ.get("ALEMBIC_DATABASE_URL", DATABASE_URL)


def run_migrations_offline():
    raise RuntimeError("A migração inicial inspeciona o banco e exige execução online.")


def run_migrations_online():
    connectable = create_engine(url, poolclass=pool.NullPool)
    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                render_as_batch=connection.dialect.name == "sqlite",
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
