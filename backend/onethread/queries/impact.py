from datetime import date, datetime, timedelta

from pydantic import BaseModel

from onethread.queries.common import PLANT_TZ, NotFound, ensure_exists


class LotStat(BaseModel):
    lot: str
    n: int
    cycle_mean_s: float
    force_mean_kn: float
    first: datetime
    last: datetime


class ShipmentImpact(BaseModel):
    id: str
    customer_id: str | None = None
    customer_name: str | None = None
    parts: int
    boxes: int
    status: str | None = None
    date: str | None = None


class Impact(BaseModel):
    lot: str
    parts: int
    boxes: int
    shipments: list[ShipmentImpact]
    delivered_shipments: int
    delivered_parts: int
    held_parts: int


def compare_by_lot(conn, machine_id: str, day: date) -> list[LotStat]:
    ensure_exists(conn, machine_id, "machine")
    start = datetime(day.year, day.month, day.day, tzinfo=PLANT_TZ)
    rows = conn.execute(
        """SELECT payload->>'lot' AS lot, count(*) AS n,
                  avg((payload->>'cycle_s')::float) AS cycle_mean_s,
                  avg((payload->>'peak_force_kn')::float) AS force_mean_kn,
                  min(event_time) AS first, max(event_time) AS last
           FROM events
           WHERE type = 'press_cycle' AND %s = ANY(object_ids) AND event_time >= %s AND event_time < %s
           GROUP BY 1 ORDER BY min(event_time)""",
        (machine_id, start, start + timedelta(days=1)),
    ).fetchall()
    return [LotStat(**r) for r in rows]


def trace_forward(conn, lot_id: str) -> Impact:
    if not conn.execute("SELECT 1 FROM objects WHERE object_id = %s AND type = 'lot'", (lot_id,)).fetchone():
        raise NotFound("lot", lot_id)
    rows = conn.execute(
        """SELECT s.to_id AS id, count(DISTINCT u.from_id) AS parts, count(DISTINCT p.to_id) AS boxes,
                  sh.attributes->>'status' AS status, sh.attributes->>'date' AS date,
                  sh.attributes->>'customer' AS customer_id, cu.name AS customer_name
           FROM links u
           JOIN links s ON s.from_id = u.from_id AND s.relation = 'shipped_in'
           JOIN links p ON p.from_id = u.from_id AND p.relation = 'packed_in'
           JOIN objects sh ON sh.object_id = s.to_id
           LEFT JOIN objects cu ON cu.object_id = sh.attributes->>'customer'
           WHERE u.relation = 'uses_lot' AND u.to_id = %s
           GROUP BY s.to_id, sh.attributes, cu.name ORDER BY sh.attributes->>'date' NULLS LAST, s.to_id""",
        (lot_id,),
    ).fetchall()
    shipments = [ShipmentImpact(**r) for r in rows]
    totals = conn.execute(
        """SELECT count(DISTINCT u.from_id) AS parts, count(DISTINCT p.to_id) AS boxes
           FROM links u JOIN links p ON p.from_id = u.from_id AND p.relation = 'packed_in'
           WHERE u.relation = 'uses_lot' AND u.to_id = %s""",
        (lot_id,),
    ).fetchone()
    delivered = [s for s in shipments if s.status == "delivered"]
    held = [s for s in shipments if s.status == "in_warehouse"]
    return Impact(
        lot=lot_id, parts=totals["parts"], boxes=totals["boxes"], shipments=shipments,
        delivered_shipments=len(delivered), delivered_parts=sum(s.parts for s in delivered),
        held_parts=sum(s.parts for s in held),
    )
