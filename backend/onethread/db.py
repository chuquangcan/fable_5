from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from onethread.config import settings


def connect(url: str | None = None) -> psycopg.Connection:
    return psycopg.connect(url or settings.database_url, row_factory=dict_row, autocommit=True)


def apply_schema(conn: psycopg.Connection) -> None:
    conn.execute((Path(__file__).parent / "schema.sql").read_text())
