import psycopg
from psycopg.rows import dict_row

from onethread.config import settings


def connect(url: str | None = None) -> psycopg.Connection:
    return psycopg.connect(url or settings.database_url, row_factory=dict_row, autocommit=True)
