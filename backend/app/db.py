"""SQLAlchemy engine + session helpers."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

# check_same_thread is a SQLite-only arg; Postgres ignores it.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables and seed default settings. Idempotent."""
    from . import models  # noqa: F401  (register models on Base)

    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    models.ensure_default_settings()


def _ensure_columns():
    """Tiny no-Alembic migration: add columns added after a table already exists.

    create_all() never alters existing tables, so new columns won't appear on a
    database created by an earlier version. ADD COLUMN is supported by both
    SQLite and Postgres; we only run it when the column is missing.
    """
    from sqlalchemy import inspect, text

    wanted = {"sessions": [("difficulty", "VARCHAR(12)")]}
    insp = inspect(engine)
    for table, cols in wanted.items():
        try:
            existing = {c["name"] for c in insp.get_columns(table)}
        except Exception:
            continue
        for name, ddl in cols:
            if name not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
