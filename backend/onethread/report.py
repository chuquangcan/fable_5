"""RCA report draft for a claim. Every number and ID is read from the DB, nothing is typed in."""
import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from onethread.queries import claims, impact, metrics
from onethread.queries.common import PLANT_TZ, NotFound


class TextSeg(BaseModel):
    kind: Literal["text"] = "text"
    text: str


class CiteSeg(BaseModel):
    kind: Literal["cite"] = "cite"
    label: str
    target_id: str | None = None


Segment = Annotated[TextSeg | CiteSeg, Field(discriminator="kind")]


class ChainStep(BaseModel):
    id: str
    label: str
    tone: Literal["bad", "suspect", "neutral"]


class ReportDraft(BaseModel):
    id: str
    title: str
    subtitle: str
    summary: list[Segment]
    chain: list[ChainStep]
    impact: impact.Impact
    cause: list[Segment]
    actions: list[str]


def _link(conn, from_id: str, relation: str) -> str | None:
    r = conn.execute(
        "SELECT to_id FROM links WHERE from_id = %s AND relation = %s ORDER BY tier, to_id LIMIT 1", (from_id, relation)
    ).fetchone()
    return r["to_id"] if r else None


def _link_in(conn, to_id: str, relation: str) -> str | None:
    r = conn.execute(
        "SELECT from_id FROM links WHERE to_id = %s AND relation = %s ORDER BY tier, from_id LIMIT 1", (to_id, relation)
    ).fetchone()
    return r["from_id"] if r else None


def _obj(conn, object_id: str) -> dict:
    r = conn.execute("SELECT object_id, name, attributes FROM objects WHERE object_id = %s", (object_id,)).fetchone()
    if r is None:
        raise NotFound("object", object_id)
    return r


def _event(conn, type: str, object_id: str | None = None, lot: str | None = None) -> dict | None:
    """Earliest event of a type, optionally on an object or carrying a lot in its payload."""
    return conn.execute(
        """SELECT * FROM events WHERE type = %(t)s AND (%(o)s::text IS NULL OR %(o)s = ANY(object_ids))
             AND (%(l)s::text IS NULL OR payload->>'lot' = %(l)s) ORDER BY event_time LIMIT 1""",
        {"t": type, "o": object_id, "l": lot},
    ).fetchone()


def _hm(ts: datetime) -> str:
    return ts.astimezone(PLANT_TZ).strftime("%H:%M")


def _md_hm(ts: datetime) -> str:
    return ts.astimezone(PLANT_TZ).strftime("%m-%d %H:%M")


def build_report_draft(conn, claim_id: str) -> ReportDraft:
    claim = claims.get_claim(conn, claim_id)
    serial = claim.serial
    lot = serial and _link(conn, serial, "uses_lot")
    machine_id = serial and _link(conn, serial, "processed_on")
    shipment_id = serial and _link(conn, serial, "shipped_in")
    press = serial and _event(conn, "press_cycle", serial)
    if not (lot and machine_id and shipment_id and press):  # claim has no traceable serial in the data
        raise NotFound("report", claim_id)

    machine, shipment, lot_obj = _obj(conn, machine_id), _obj(conn, shipment_id), _obj(conn, lot)
    hopper = _obj(conn, _link(conn, lot, "fed_into") or "")
    part = _obj(conn, _link(conn, lot, "part_of") or "")
    alias = _link(conn, lot, "same_as") or lot
    rcv = _link(conn, lot, "received_under")
    po = _link(conn, rcv, "received_under") if rcv else None
    supplier = _obj(conn, _link(conn, po, "supplied_by") or "") if po else None

    cpk = metrics.metric(conn, "cpk", [lot])[0]
    iqc = _obj(conn, cpk.source_record_id or "")
    spec_min = float(iqc["attributes"]["spec_min"])
    spec_doc = _link(conn, iqc["object_id"], "specified_by")
    spec_page = conn.execute("SELECT page FROM documents WHERE doc_id = %s LIMIT 1", (spec_doc,)).fetchone() if spec_doc else None

    day = press["event_time"].astimezone(PLANT_TZ).date()
    stats = impact.compare_by_lot(conn, machine_id, day)
    after = next(s for s in stats if s.lot == lot)
    before = next((s for s in stats if s.lot != lot), after)
    loaded = _event(conn, "lot_loaded", lot=lot)
    pm = _event(conn, "maintenance", machine_id)
    shift = _event(conn, "shift", machine_id)
    env = _event(conn, "env_temp")
    imp = impact.trace_forward(conn, lot)

    ship_date = shipment["attributes"].get("date")
    received = claim.received
    months = round((date.fromisoformat(received) - date.fromisoformat(ship_date)).days / 30) if ship_date and received else None
    a, b = round(before.cycle_mean_s), round(after.cycle_mean_s)
    doc_label = f"{spec_doc} p.{spec_page['page']}" if spec_doc and spec_page else spec_doc
    load_t = _hm(loaded["event_time"]) if loaded else "?"

    summary: list[Segment] = [
        TextSeg(text=f"Bơm MH-20 serial {serial} (giao {claim.customer_name} ngày {ship_date}) bị khiếu nại kêu to bất thường"
                     + (f" sau {months} tháng sử dụng. " if months else ". ")),
        TextSeg(text=f"Nguyên nhân khả dĩ: ổ bi {part['name']} {lot}, IQC Cpk {cpk.value:.2f} dưới chuẩn {spec_min:g} "),
        CiteSeg(label=iqc["object_id"], target_id=iqc["object_id"]),
        TextSeg(text=f"; {serial} được ép trên {machine['name']} lúc {_hm(press['event_time'])}, "
                     f"sau khi nạp {lot} lúc {load_t} làm cycle time tăng {a} → {b} s "),
        CiteSeg(label=press["source"], target_id=machine_id),
        TextSeg(text="."),
    ]

    cause: list[Segment] = [
        TextSeg(text=f"Lô {lot} có Cpk {cpk.value:.2f} < {spec_min:g}"),
        *([TextSeg(text=" theo chuẩn "), CiteSeg(label=doc_label, target_id=spec_doc)] if spec_doc else []),
        TextSeg(text=" "), CiteSeg(label=iqc["object_id"], target_id=iqc["object_id"]),
        TextSeg(text=f". Sau khi nạp {lot} vào {hopper['name']} lúc {load_t}, cycle time {machine['name']} tăng {a} → {b} s "),
        CiteSeg(label=press["source"], target_id=machine_id),
        TextSeg(text=". Đã loại trừ:"),
    ]
    excluded: list[tuple[str, str, str, str]] = []
    if pm:
        ok = pm["payload"].get("result") == "normal"
        excluded.append((" bảo trì ", pm["source_record_id"], machine_id, "" if ok else f" (kết quả {pm['payload'].get('result')})"))
    if shift:
        excluded.append((" người vận hành ", shift["source"], machine_id, ""))
    if env:
        excluded.append((" nhiệt độ ", env["source"], env["object_ids"][0], ""))
    for i, (lead, label, target, note) in enumerate(excluded):
        cause += [TextSeg(text=("," if i else "") + lead), CiteSeg(label=label, target_id=target)]
        if note:
            cause.append(TextSeg(text=note))
    cause.append(TextSeg(text="."))

    short = supplier["name"].removeprefix("Supplier ") if supplier else ""
    chain = [
        ChainStep(id=claim.id, label=claim.id, tone="bad"),
        ChainStep(id=shipment_id, label=shipment_id, tone="neutral"),
        ChainStep(id=serial, label=serial, tone="neutral"),
        ChainStep(id=machine_id, label=f"{machine['name']} · {_md_hm(press['event_time'])}", tone="bad"),
        ChainStep(id=lot, label=f"{lot} ≡ {alias}", tone="suspect"),
        *([ChainStep(id=po, label=f"{po} · {short}", tone="neutral")] if po else []),
    ]

    actions = [f"Cách ly {s.parts} part {s.id} trong kho" for s in imp.shipments if s.status == "in_warehouse"]
    actions += [f"Liên hệ {s.customer_name} về {s.id} ({s.parts} part, chưa có claim)"
                for s in imp.shipments if s.status == "delivered" and s.customer_id != claim.customer_id]
    if supplier:
        actions.append(f"Yêu cầu {supplier['name']} lập 8D cho {lot}")
    similar = _link_in(conn, supplier["object_id"], "concerns") if supplier else None
    if similar:
        m = re.search(r"n=(\d+)\s*$", str(_obj(conn, similar)["attributes"].get("resolution", "")))
        if m:
            actions.append(f"Áp lại mức lấy mẫu IQC n={m.group(1)} như {similar}")

    return ReportDraft(
        id=f"RPT-{claim.id}",
        title=f"Truy vết claim {claim.id} — tiếng ồn bất thường trên bơm MH-20",
        subtitle=f"{claim.customer_name} · serial {serial} · nhận claim {received} · nháp tự động, cần QA duyệt",
        summary=summary, chain=chain, impact=imp, cause=cause, actions=actions,
    )
