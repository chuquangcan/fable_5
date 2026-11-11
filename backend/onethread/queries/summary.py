"""Cited overview of any node (DEMO-18): parameters, each with its source system, plus related docs."""

from collections import deque
from datetime import date, datetime
from typing import Any

import psycopg
from pydantic import BaseModel

from onethread.flow import FLOW_STATUSES, flow_edges
from onethread.queries.common import PLANT_TZ, NotFound, node_info
from onethread.queries.docs import DocView, get_docs
from onethread.queries.events import Event, get_events
from onethread.queries.impact import compare_by_lot, trace_forward
from onethread.queries.links import get_links
from onethread.queries.thread_flow import DEFAULT_STAGE

AGG_PREFIX = "AGG-"
ATTACHMENT_STAGE = "dinh_kem"  # events and sources sit with the attachments, not in a flow stage column
TIME = "%Y-%m-%d %H:%M"


class Param(BaseModel):
    label: str
    value: str | float | int
    unit: str | None = None
    source: str
    source_record_id: str | None = None


class NodeSummary(BaseModel):
    id: str
    type: str
    name: str
    stage: str
    aliases: list[str]
    params: list[Param]
    docs: list[DocView]
    counts: dict[str, int]


def _fmt(t: datetime | str, pattern: str = TIME) -> str:
    if isinstance(t, str):
        t = datetime.fromisoformat(t)
    return t.astimezone(PLANT_TZ).strftime(pattern) if t.tzinfo else t.strftime(pattern)


def _linked(conn: psycopg.Connection, id: str, relation: str, *, outgoing: bool) -> list[str]:
    """Other ends of confirmed/inferred `relation` links: id -> other (outgoing) or other -> id."""
    a, b = ("from_id", "to_id") if outgoing else ("to_id", "from_id")
    return [r["o"] for r in conn.execute(
        f"SELECT {b} AS o FROM links WHERE {a} = %s AND relation = %s AND status = ANY(%s) ORDER BY link_id",
        (id, relation, list(FLOW_STATUSES)))]


def _events(conn: psycopg.Connection, id: str, type: str) -> list[Event]:
    return get_events(conn, id, type=type)


def _supplier(conn: psycopg.Connection, id: str) -> str | None:
    """Closest supplier upstream of `id` along flow edges (lot -> receipt -> PO -> supplier)."""
    ups: dict[str, list[str]] = {}
    for e in flow_edges(conn):
        ups.setdefault(e.down, []).append(e.up)
    seen, order, queue = {id}, [], deque([id])
    while queue:
        for up in ups.get(queue.popleft(), []):
            if up not in seen:
                seen.add(up)
                order.append(up)
                queue.append(up)
    info = node_info(conn, order)
    return next((i for i in order if info.get(i, {}).get("type") == "supplier"), None)


def _receipt_param(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    for e in _events(conn, id, "goods_receipt"):
        return [Param(label="Ngày nhập", value=_fmt(e.event_time), source=e.source,
                      source_record_id=e.source_record_id)]
    if attrs.get("received_at"):
        return [Param(label="Ngày nhập", value=_fmt(attrs["received_at"]), source="WMS",
                      source_record_id=id)]
    return []


# ---- one params builder per node type: (conn, id, attributes) -> list[Param] ----

def _production_day(conn: psycopg.Connection, machine_id: str) -> date | None:
    """The plant day with the most press cycles, not the day of the latest one: LOT-B cycles run past
    midnight (until 01:31 the next day), so the latest cycle falls on a day with only a few cycles and
    no LOT-A to compare against. The spill past 00:00 does not move the busiest day."""
    hours = int(PLANT_TZ.utcoffset(None).total_seconds() // 3600)
    row = conn.execute(
        """SELECT ((event_time AT TIME ZONE 'UTC') + make_interval(hours => %s))::date AS d, count(*) AS n
           FROM events WHERE type = 'press_cycle' AND %s = ANY(object_ids)
           GROUP BY 1 ORDER BY n DESC, d DESC LIMIT 1""",
        (hours, machine_id)).fetchone()
    return row["d"] if row else None


def _params_machine(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out: list[Param] = []
    day = _production_day(conn, id)
    if day is not None:
        stats = compare_by_lot(conn, id, day)
        for s in stats:
            out.append(Param(label=f"Cycle TB · {s.lot}", value=round(s.cycle_mean_s, 1), unit="s", source="PLC2"))
            out.append(Param(label=f"Lực ép TB · {s.lot}", value=round(s.force_mean_kn, 1), unit="kN",
                             source="PLC2"))
    if attrs.get("cycle_target_s") is not None:
        out.append(Param(label="Mục tiêu cycle", value=attrs["cycle_target_s"], unit="s", source="MES"))
    if day is not None:
        out.append(Param(label=f"Số chu kỳ {day:%m-%d}", value=sum(s.n for s in stats), source="PLC2"))
    if maint := _events(conn, id, "maintenance"):
        m = maint[-1]
        result = m.payload.get("result", "")
        out.append(Param(label="Bảo trì gần nhất", value=f"{_fmt(m.event_time, '%Y-%m-%d')} · {result}",
                         source=m.source, source_record_id=m.source_record_id))
    if shifts := _events(conn, id, "shift"):
        s = shifts[-1]
        out.append(Param(label="Vận hành", value=f"{s.payload.get('operator', '')} · {s.payload.get('shift', '')}",
                         source=s.source, source_record_id=s.source_record_id))
    if day is not None:
        for line in _linked(conn, id, "part_of", outgoing=True):
            start = datetime(day.year, day.month, day.day, tzinfo=PLANT_TZ)
            temps = [(e.payload["temp_c"], e.source) for e in get_events(conn, line, start, None, "env_temp")
                     if _fmt(e.event_time, "%Y-%m-%d") == day.isoformat() and "temp_c" in e.payload]
            if temps:
                lo, hi = min(t for t, _ in temps), max(t for t, _ in temps)
                out.append(Param(label="Nhiệt độ line", value=f"{lo:.1f}–{hi:.1f}", unit="°C",
                                 source=temps[0][1]))
                break
    return out


def _params_hopper(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    for e in _events(conn, id, "lot_loaded"):
        lot = e.payload.get("lot") or next((o for o in e.object_ids if o != id), "")
        out.append(Param(label=f"Nạp {lot}", value=_fmt(e.event_time, "%m-%d %H:%M"), source=e.source,
                         source_record_id=e.source_record_id))
    return out


def _params_lot(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    if attrs.get("qty") is not None:
        out.append(Param(label="Số lượng", value=attrs["qty"], unit="pcs", source="ERP"))
    if part := attrs.get("part"):
        out.append(Param(label="Linh kiện", value=node_info(conn, [part]).get(part, {}).get("name", part),
                         source="PLM"))
    if supplier := _supplier(conn, id):
        out.append(Param(label="Nhà cung cấp", value=supplier, source="ERP"))
    out += _receipt_param(conn, id, attrs)
    for iqc in _linked(conn, id, "inspected", outgoing=False):
        a = node_info(conn, [iqc]).get(iqc, {}).get("attributes") or {}
        if a.get("cpk") is not None:
            out.append(Param(label="Cpk IQC", value=f"{a['cpk']} · {a.get('verdict', '')}", source="QMS",
                             source_record_id=iqc))
    if (parts := trace_forward(conn, id).parts) > 0:
        out.append(Param(label="Part đã dùng", value=parts, source="MES"))
    return out


def _params_po_receipt(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    if attrs.get("qty") is not None:
        out.append(Param(label="Số lượng", value=attrs["qty"], unit="pcs", source="ERP"))
    if supplier := _supplier(conn, id):
        out.append(Param(label="Nhà cung cấp", value=supplier, source="ERP"))
    return out + _receipt_param(conn, id, attrs)


def _params_supplier(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    if attrs.get("erp_code"):
        out.append(Param(label="Mã ERP", value=attrs["erp_code"], source="ERP"))
    downs = sorted({e.down for e in flow_edges(conn) if e.up == id})
    info = node_info(conn, downs)
    if pos := [i for i in downs if info.get(i, {}).get("type") == "purchase_order"]:
        out.append(Param(label="PO", value=", ".join(pos), source="ERP"))
    rows = conn.execute(
        "SELECT DISTINCT CASE WHEN from_id = %(o)s THEN to_id ELSE from_id END AS other FROM links"
        " WHERE (from_id = %(o)s OR to_id = %(o)s) AND status = ANY(%(st)s)",
        {"o": id, "st": list(FLOW_STATUSES)}).fetchall()
    others = node_info(conn, [r["other"] for r in rows])
    if claims := sorted(i for i, n in others.items() if n["type"] == "claim"):
        out.append(Param(label="Claim liên quan", value=", ".join(claims), source="QMS"))
    return out


def _params_serial(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    link = conn.execute(
        "SELECT evidence FROM links WHERE from_id = %s AND relation = 'processed_on' AND status = ANY(%s)"
        " ORDER BY link_id LIMIT 1", (id, list(FLOW_STATUSES))).fetchone()
    if presses := _events(conn, id, "press_cycle"):
        record = ((link or {}).get("evidence") or {}).get("source_record_id")
        out.append(Param(label="Ép lúc", value=_fmt(presses[0].event_time), source="PLC2",
                         source_record_id=record))
    for label, relation, source in (("Máy", "processed_on", "MES"), ("Lô", "uses_lot", "MES"),
                                    ("Thùng", "packed_in", "MES"), ("Lô xuất", "shipped_in", "WMS")):
        if targets := _linked(conn, id, relation, outgoing=True):
            out.append(Param(label=label, value=targets[0], source=source))
    return out


def _params_shipment(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    for label, key in (("Số part", "parts"), ("Số thùng", "boxes"), ("Trạng thái", "status"),
                       ("Ngày giao", "date"), ("Khách", "customer")):
        if attrs.get(key) is not None:
            out.append(Param(label=label, value=attrs[key], source="WMS"))
    return out


def _shipments_of_order(conn: psycopg.Connection, order: str) -> list[str]:
    return _linked(conn, order, "ordered_in", outgoing=False)


def _params_sales_order(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    if customers := _linked(conn, id, "delivered_to", outgoing=True):
        out.append(Param(label="Khách", value=customers[0], source="ERP"))
    if shipments := _shipments_of_order(conn, id):
        out.append(Param(label="Lô xuất", value=", ".join(sorted(shipments)), source="ERP"))
    return out


def _params_customer(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    shipments = {s for so in _linked(conn, id, "delivered_to", outgoing=False)
                 for s in _shipments_of_order(conn, so)}
    return [Param(label="Lô xuất", value=", ".join(sorted(shipments)), source="ERP")] if shipments else []


def _params_claim(conn: psycopg.Connection, id: str, attrs: dict[str, Any]) -> list[Param]:
    out = []
    for label, key in (("Triệu chứng", "symptom"), ("Ngày nhận", "received"), ("Serial", "serial"),
                       ("Khách", "customer")):
        if attrs.get(key) is not None:
            out.append(Param(label=label, value=attrs[key], source="QMS"))
    return out


def _params_aggregate(conn: psycopg.Connection, lot: str) -> list[Param]:
    impact = trace_forward(conn, lot)
    out = [Param(label="Số part", value=impact.parts, source="MES"),
           Param(label="Số thùng", value=impact.boxes, source="MES")]
    for s in impact.shipments:
        out.append(Param(label="Lô xuất", value=f"{s.id} · {s.parts} part · {s.status}", source="WMS"))
    return out


PARAMS_BY_TYPE = {
    "machine": _params_machine,
    "hopper": _params_hopper,
    "lot": _params_lot,
    "purchase_order": _params_po_receipt,
    "receipt": _params_po_receipt,
    "supplier": _params_supplier,
    "serial": _params_serial,
    "shipment": _params_shipment,
    "sales_order": _params_sales_order,
    "customer": _params_customer,
    "claim": _params_claim,
}


def _aggregate_summary(conn: psycopg.Connection, lot: str) -> NodeSummary:
    params = _params_aggregate(conn, lot)  # NotFound unless `lot` is a lot
    parts = params[0].value
    return NodeSummary(id=f"{AGG_PREFIX}{lot}", type="aggregate", name=f"+{parts:,} part · {lot}",
                       stage=DEFAULT_STAGE["aggregate"], aliases=[], params=params, docs=[],
                       counts={"links": 0, "events": 0})


def _param_value(v: Any) -> str | float | int:
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v
    return v if isinstance(v, str) else str(v)


def _event_summary(conn: psycopg.Connection, record_id: str) -> NodeSummary | None:
    """A side-event record the agent may cite (PM-0241, HR-SHIFT-1103, ...): its time, objects and payload."""
    e = conn.execute(
        "SELECT type, object_ids, event_time, source, payload FROM events WHERE source_record_id = %s"
        " ORDER BY event_time, event_id LIMIT 1", (record_id,)).fetchone()
    if e is None:
        return None
    cite = {"source": e["source"] or "", "source_record_id": record_id}
    params = [Param(label="Thời điểm", value=_fmt(e["event_time"]), **cite)]
    if e["object_ids"]:
        params.append(Param(label="Đối tượng", value=", ".join(e["object_ids"]), **cite))
    params += [Param(label=k, value=_param_value(v), **cite) for k, v in (e["payload"] or {}).items()]
    return NodeSummary(id=record_id, type="event", name=f"{e['type']} · {_fmt(e['event_time'])}",
                       stage=ATTACHMENT_STAGE, aliases=[], params=params, docs=[],
                       counts={"links": 0, "events": 1})


def _source_summary(conn: psycopg.Connection, source: str) -> NodeSummary | None:
    """An event source system (PLC2, CMMS, ENV-L1, ...): how many events of which types it holds."""
    rows = conn.execute("SELECT type, count(*) AS n FROM events WHERE source = %s GROUP BY type ORDER BY type",
                        (source,)).fetchall()
    if not rows:
        return None
    n = sum(r["n"] for r in rows)
    params = [Param(label="Số sự kiện", value=n, source=source),
              Param(label="Loại sự kiện", value=", ".join(r["type"] for r in rows), source=source)]
    return NodeSummary(id=source, type="source", name=source, stage=ATTACHMENT_STAGE, aliases=[],
                       params=params, docs=[], counts={"links": 0, "events": n})


def node_summary(conn: psycopg.Connection, id: str) -> NodeSummary:
    """Objects and documents first; else an event record ID or an event source (both citable by the agent)."""
    if id.startswith(AGG_PREFIX):
        return _aggregate_summary(conn, id.removeprefix(AGG_PREFIX))
    info = node_info(conn, [id]).get(id)
    if info is None:
        if (other := _event_summary(conn, id) or _source_summary(conn, id)) is not None:
            return other
        raise NotFound("object", id)
    attrs = info["attributes"] or {}
    build = PARAMS_BY_TYPE.get(info["type"])
    params = build(conn, id, attrs) if build else []
    alias_rows = conn.execute(
        "SELECT from_id, to_id FROM links WHERE relation = 'same_as' AND status = ANY(%s)"
        " AND (from_id = %s OR to_id = %s) ORDER BY link_id", (list(FLOW_STATUSES), id, id)).fetchall()
    aliases = [r["to_id"] if r["from_id"] == id else r["from_id"] for r in alias_rows]
    n_events = conn.execute("SELECT count(*) AS n FROM events WHERE %s = ANY(object_ids)", (id,)).fetchone()["n"]
    return NodeSummary(
        id=id, type=info["type"], name=info["name"], stage=attrs.get("stage") or DEFAULT_STAGE.get(info["type"], ""),
        aliases=aliases, params=params, docs=get_docs(conn, id),
        counts={"links": len(get_links(conn, id)), "events": n_events},
    )
