"""Generic analyses behind the deep evidence tabs: a machine's cycle window and a lot-vs-lot comparison.

They used to be hard-wired in the frontend to the demo story (M02 on 2026-11-03 12:00-16:00, LOT-A vs LOT-B);
here they are derived from the data, so any machine with press cycles or any lot with an IQC works.
"""
from datetime import date, datetime, timedelta

import psycopg
from pydantic import BaseModel

from onethread.flow import FLOW_STATUSES, flow_edges
from onethread.queries.common import PLANT_TZ, NotFound, node_info
from onethread.queries.summary import _production_day, _supplier

WINDOW = timedelta(hours=4)
LEAD = timedelta(hours=1)  # the window opens this long before a lot change, so both sides show


class LotChange(BaseModel):
    time: datetime
    lot: str
    hopper: str
    source: str
    source_record_id: str | None = None


class MachineWindow(BaseModel):
    machine: str
    name: str
    day: date | None = None
    start: datetime | None = None
    end: datetime | None = None
    cycle_source: str | None = None
    target_s: float | None = None
    line: str | None = None
    hoppers: list[str]
    change: LotChange | None = None
    offset_s: float | None = None  # clock offset of the cycle source (time_mappings), if any


def _floor_hour(t: datetime) -> datetime:
    t = t.astimezone(PLANT_TZ)
    return t.replace(minute=0, second=0, microsecond=0)


def machine_window(conn: psycopg.Connection, machine_id: str) -> MachineWindow:
    info = node_info(conn, [machine_id]).get(machine_id)
    if info is None or info["type"] != "machine":
        raise NotFound("machine", machine_id)
    attrs = info["attributes"] or {}
    hoppers = sorted({e.up for e in flow_edges(conn) if e.down == machine_id and e.relation == "fed_into"
                      and node_info(conn, [e.up]).get(e.up, {}).get("type") == "hopper"})
    line = next((r["to_id"] for r in conn.execute(
        "SELECT to_id FROM links WHERE from_id = %s AND relation = 'part_of' AND status = ANY(%s) ORDER BY link_id",
        (machine_id, list(FLOW_STATUSES)))), None)
    out = MachineWindow(machine=machine_id, name=info["name"], hoppers=hoppers, line=line,
                        target_s=attrs.get("cycle_target_s"))
    day = _production_day(conn, machine_id)
    if day is None:
        return out  # no press cycles: the tab says so
    day_start = datetime(day.year, day.month, day.day, tzinfo=PLANT_TZ)
    src = conn.execute(
        "SELECT source, min(event_time) AS first FROM events WHERE type = 'press_cycle' AND %s = ANY(object_ids)"
        " AND event_time >= %s AND event_time < %s GROUP BY source ORDER BY count(*) DESC LIMIT 1",
        (machine_id, day_start, day_start + timedelta(days=1))).fetchone()
    load = conn.execute(
        """SELECT event_time, payload->>'lot' AS lot, object_ids, source, source_record_id FROM events
           WHERE type = 'lot_loaded' AND object_ids && %s::text[] AND event_time >= %s AND event_time < %s
           ORDER BY event_time LIMIT 1""",
        (hoppers, day_start, day_start + timedelta(days=1))).fetchone() if hoppers else None
    if load:
        hopper = next(h for h in hoppers if h in load["object_ids"])
        lot = load["lot"] or next((o for o in load["object_ids"] if o != hopper), "")
        out.change = LotChange(time=load["event_time"], lot=lot, hopper=hopper, source=load["source"],
                               source_record_id=load["source_record_id"])
        start = _floor_hour(load["event_time"] - LEAD)
    else:
        start = _floor_hour(src["first"])
    offset = conn.execute("SELECT offset_s FROM time_mappings WHERE source = %s ORDER BY valid_from DESC LIMIT 1",
                          (src["source"],)).fetchone()
    out.day, out.start, out.end, out.cycle_source = day, start, start + WINDOW, src["source"]
    out.offset_s = offset["offset_s"] if offset else None
    return out


class LotRow(BaseModel):
    lot: str
    received_at: datetime | None = None
    receipt: str | None = None
    supplier: str | None = None
    iqc: str | None = None
    cpk: float | None = None
    verdict: str | None = None
    spec_min: float | None = None
    spec_doc: str | None = None
    spec_page: int | None = None


class SimilarClaim(BaseModel):
    id: str
    period: str | None = None
    symptom: str | None = None
    resolution: str | None = None
    via: str            # the supplier or part the claim is linked to
    tier: int
    status: str
    docs: list[str]     # documents that describe the claim (confirmed/inferred)


class LotCompare(BaseModel):
    lot: str
    part: str | None = None
    part_name: str | None = None
    rows: list[LotRow]
    similar: list[SimilarClaim]


def _resolve_lot(conn: psycopg.Connection, id: str) -> str:
    """A lot id as is; an IQC to the lot it inspected; an aggregate AGG-<lot> to its lot."""
    id = id.removeprefix("AGG-")
    info = node_info(conn, [id]).get(id)
    if info is not None and info["type"] == "inspection":
        row = conn.execute("SELECT to_id FROM links WHERE from_id = %s AND relation = 'inspected' ORDER BY link_id LIMIT 1",
                           (id,)).fetchone()
        id = row["to_id"] if row else id
        info = node_info(conn, [id]).get(id)
    if info is None or info["type"] != "lot":
        raise NotFound("lot", id)
    return id


def _lot_row(conn: psycopg.Connection, lot: str) -> LotRow:
    row = LotRow(lot=lot, supplier=_supplier(conn, lot))
    rcv = conn.execute(
        "SELECT event_time, source_record_id FROM events WHERE type = 'goods_receipt' AND %s = ANY(object_ids)"
        " ORDER BY event_time LIMIT 1", (lot,)).fetchone()
    if rcv:
        row.received_at, row.receipt = rcv["event_time"], rcv["source_record_id"]
    iqc = conn.execute(
        """SELECT i.object_id, i.attributes FROM links l JOIN objects i ON i.object_id = l.from_id
           WHERE l.to_id = %s AND l.relation = 'inspected' AND l.status = ANY(%s) ORDER BY i.object_id LIMIT 1""",
        (lot, list(FLOW_STATUSES))).fetchone()
    if iqc:
        a = iqc["attributes"] or {}
        row.iqc, row.cpk, row.verdict, row.spec_min = iqc["object_id"], a.get("cpk"), a.get("verdict"), a.get("spec_min")
        spec = conn.execute(
            """SELECT d.doc_id, d.page FROM links l JOIN documents d ON d.doc_id = l.to_id
               WHERE l.from_id = %s AND l.relation = 'specified_by' AND l.status = ANY(%s) ORDER BY l.link_id, d.chunk_id LIMIT 1""",
            (iqc["object_id"], list(FLOW_STATUSES))).fetchone()
        if spec:
            row.spec_doc, row.spec_page = spec["doc_id"], spec["page"]
    return row


def lot_compare(conn: psycopg.Connection, id: str) -> LotCompare:
    lot = _resolve_lot(conn, id)
    part = (node_info(conn, [lot])[lot]["attributes"] or {}).get("part")
    lots = [lot]
    if part:
        lots = [r["object_id"] for r in conn.execute(
            "SELECT object_id FROM objects WHERE type = 'lot' AND attributes->>'part' = %s ORDER BY object_id", (part,))]
    rows = [_lot_row(conn, l) for l in lots]
    anchors = sorted({r.supplier for r in rows if r.supplier} | ({part} if part else set()))
    claims = conn.execute(
        """SELECT c.object_id, c.attributes, l.tier, l.status,
                  CASE WHEN l.from_id = c.object_id THEN l.to_id ELSE l.from_id END AS via
           FROM links l JOIN objects c ON c.object_id IN (l.from_id, l.to_id) AND c.type = 'claim'
           WHERE (l.from_id = ANY(%(a)s) OR l.to_id = ANY(%(a)s)) AND l.status = ANY(%(s)s)
             AND c.attributes->>'status' = 'closed'
           ORDER BY c.object_id, l.tier""",
        {"a": anchors, "s": list(FLOW_STATUSES)}).fetchall()
    similar: dict[str, SimilarClaim] = {}
    for c in claims:
        if c["object_id"] in similar:
            continue
        a = c["attributes"] or {}
        docs = [r["from_id"] for r in conn.execute(
            "SELECT from_id FROM links WHERE to_id = %s AND relation = 'describes' AND status = ANY(%s) ORDER BY from_id",
            (c["object_id"], list(FLOW_STATUSES)))]
        similar[c["object_id"]] = SimilarClaim(
            id=c["object_id"], period=a.get("period"), symptom=a.get("symptom"), resolution=a.get("resolution"),
            via=c["via"], tier=c["tier"], status=c["status"], docs=docs)
    part_name = node_info(conn, [part]).get(part, {}).get("name") if part else None
    return LotCompare(lot=lot, part=part, part_name=part_name, rows=rows, similar=list(similar.values()))
