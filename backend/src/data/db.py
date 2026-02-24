"""
Postgres connection pool for shared network persistence.

Lazily initialised on first use.  If no DATABASE_URL is configured the pool
is never created and ``get_pool()`` returns ``None`` — callers should treat
this as "sharing disabled" and return 503.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from src.config import settings

log = logging.getLogger(__name__)

_pool: ConnectionPool | None = None
_initialised = False


def _init_pool() -> None:
    global _pool, _initialised
    if _initialised:
        return
    _initialised = True

    dsn = settings.database_url
    if not dsn:
        log.warning("BIKESHARE_DATABASE_URL not set — network sharing disabled")
        return

    _pool = ConnectionPool(
        conninfo=dsn,
        min_size=1,
        max_size=4,
        kwargs={"row_factory": dict_row, "autocommit": False},
        open=True,
    )
    log.info("Postgres connection pool ready (%s)", dsn.split("@")[-1])


def get_pool() -> ConnectionPool | None:
    """Return the connection pool, or ``None`` if DB is not configured."""
    if not _initialised:
        _init_pool()
    return _pool


@contextmanager
def get_conn() -> Generator[psycopg.Connection, None, None]:
    """Borrow a connection from the pool.  Commits on clean exit, rolls back
    on exception.  Raises ``RuntimeError`` if DB is not configured."""
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database not configured")
    with pool.connection() as conn:
        yield conn
