from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from onethread.queries.common import ensure_exists


class MetricValue(BaseModel):
    object_id: str
    value: float | None
    source_record_id: str | None = None


def metric(conn, kpi: Literal["cpk", "cycle_time"], object_ids: list[str],
           start: datetime | None = None, end: datetime | None = None) -> list[MetricValue]:
    out = []
    for oid in object_ids:
        ensure_exists(conn, oid)
        if kpi == "cpk":
            r = conn.execute(
                """SELECT i.object_id AS src, (i.attributes->>'cpk')::float AS value
                   FROM links l JOIN objects i ON i.object_id = l.from_id
                   WHERE l.to_id = %s AND l.relation = 'inspected' AND i.attributes ? 'cpk'
                   ORDER BY i.object_id LIMIT 1""",
                (oid,),
            ).fetchone()
        else:
            r = conn.execute(
                """SELECT 'PLC2' AS src, avg((payload->>'cycle_s')::float) AS value FROM events
                   WHERE type = 'press_cycle' AND payload->>'lot' = %(o)s
                     AND (%(s)s::timestamptz IS NULL OR event_time >= %(s)s)
                     AND (%(e)s::timestamptz IS NULL OR event_time <= %(e)s)""",
                {"o": oid, "s": start, "e": end},
            ).fetchone()
        out.append(MetricValue(object_id=oid, value=r["value"] if r else None,
                               source_record_id=r["src"] if r and r["value"] is not None else None))
    return out
