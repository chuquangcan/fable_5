from datetime import datetime
from typing import Any

from pydantic import BaseModel

from onethread.queries.common import ensure_exists


class Event(BaseModel):
    event_id: str
    type: str
    object_ids: list[str]
    event_time: datetime
    time_kind: str
    source: str
    source_record_id: str | None = None
    payload: dict[str, Any] = {}


def get_events(conn, object_id: str, start: datetime | None = None, end: datetime | None = None,
               type: str | None = None, limit: int = 2000) -> list[Event]:
    ensure_exists(conn, object_id)
    rows = conn.execute(
        """SELECT event_id, type, object_ids, event_time, time_kind, source, source_record_id, payload
           FROM events
           WHERE %(o)s = ANY(object_ids)
             AND (%(s)s::timestamptz IS NULL OR event_time >= %(s)s)
             AND (%(e)s::timestamptz IS NULL OR event_time <= %(e)s)
             AND (%(t)s::text IS NULL OR type = %(t)s)
           ORDER BY event_time, event_id LIMIT %(l)s""",
        {"o": object_id, "s": start, "e": end, "t": type, "l": limit},
    ).fetchall()
    return [Event(**r) for r in rows]
