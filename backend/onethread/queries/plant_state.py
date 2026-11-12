"""The plant as of one demo time (spec 2026-11-12 §2.5–2.6): each twin node's state and live value, the links
between plant assets that hold at that time, and the overview's KPI tiles and per-line / per-machine rows."""
from datetime import datetime, timedelta
from statistics import median
from typing import Any, Literal

import psycopg
from pydantic import BaseModel

from onethread.departments import dept_of_source
from onethread.queries.impact import trace_forward
from onethread.review import REVIEWABLE

ASSET_TYPES = ["receipt", "lot", "line", "hopper", "machine", "inspection", "shipment"]
RUNNING_WINDOW = timedelta(minutes=5)  # a machine with a cycle in the last 5 minutes is running
CYCLE_SAMPLE = 20                      # the live cycle is the median of the last 20 cycles
TREND_POINTS, TREND_BUCKET = 30, timedelta(minutes=8)
OPEN = ("proposed", "watching")

State = Literal["running", "stopped", "warning", "watch4m", "idle"]


class NodeState(BaseModel):
    state: State
    value: str
    sub: str | None = None


class TwinEdge(BaseModel):
    from_id: str
    to_id: str
    relation: str
    status: str


class PlantState(BaseModel):
    at: datetime
    nodes: dict[str, NodeState]
    edges: list[TwinEdge]


class Kpis(BaseModel):
    output: int
    cycle_s: float | None
    target_s: float | None
    open_alerts: int
    watch_4m: int
    pending_links: int


class OverviewRow(BaseModel):
    id: str
    kind: Literal["line", "machine"]
    name: str
    line: str | None
    state: State
    cycle_s: float | None
    target_s: float | None
    output: int
    lot: str | None
    trend: list[float]


class ShipmentRisk(BaseModel):
    id: str
    status: str | None
    date: str | None
    customer: str | None
    parts: int
    risk: Literal["high", "none"]
    reason: str


class SourceRow(BaseModel):
    source: str
    dept: str | None
    events: int
    last_at: datetime | None
    delay_s: float | None


class PlantOverview(BaseModel):
    at: datetime
    kpis: Kpis
    rows: list[OverviewRow]
    shipments: list[ShipmentRisk]
    sources: list[SourceRow]


# ---------------------------------------------------------------- shared reads

def _assets(conn) -> dict[str, dict[str, Any]]:
    rows = conn.execute("SELECT object_id, type, name, attributes FROM objects WHERE type = ANY(%s) ORDER BY object_id",
                        (ASSET_TYPES,)).fetchall()
    return {r["object_id"]: {"type": r["type"], "name": r["name"], **(r["attributes"] or {})} for r in rows}


def _valid(evidence: dict | None, at: datetime) -> bool:
    ev = evidence or {}
    start, end = ev.get("valid_from"), ev.get("valid_to")
    return (not start or datetime.fromisoformat(start) <= at) and (not end or at < datetime.fromisoformat(end))


def _edges(conn, ids: list[str], at: datetime) -> list[TwinEdge]:
    rows = conn.execute(
        """SELECT from_id, to_id, relation, status, evidence FROM links
           WHERE from_id = ANY(%(i)s) AND to_id = ANY(%(i)s) ORDER BY link_id""", {"i": ids}).fetchall()
    return [TwinEdge(**{k: r[k] for k in ("from_id", "to_id", "relation", "status")}) for r in rows
            if _valid(r["evidence"], at)]


def _open_notices(conn, at: datetime) -> list[dict]:
    return conn.execute("SELECT kind, object_ids FROM notices WHERE status = ANY(%s) AND at <= %s",
                        (list(OPEN), at)).fetchall()


def _cycles(conn, machine: str, at: datetime) -> list[tuple[datetime, float]]:
    """Cycles of one machine from 00:00 of `at`'s day (or the last CYCLE_SAMPLE before it, if more) up to `at`."""
    day = at.replace(hour=0, minute=0, second=0, microsecond=0)
    since = min(day, at - TREND_POINTS * TREND_BUCKET)
    rows = conn.execute(
        """SELECT event_time, (payload->>'cycle_s')::float AS c FROM events
           WHERE type = 'press_cycle' AND %s = ANY(object_ids) AND event_time > %s AND event_time <= %s
           ORDER BY event_time""", (machine, since, at)).fetchall()
    if len(rows) < CYCLE_SAMPLE:
        rows = list(reversed(conn.execute(
            """SELECT event_time, (payload->>'cycle_s')::float AS c FROM events
               WHERE type = 'press_cycle' AND %s = ANY(object_ids) AND event_time <= %s
               ORDER BY event_time DESC LIMIT %s""", (machine, at, CYCLE_SAMPLE)).fetchall()))
    return [(r["event_time"], r["c"]) for r in rows]


class _Machine(BaseModel):
    id: str
    cycle: float | None
    target: float | None
    running: bool
    output: int
    trend: list[float]


def _machine(conn, mid: str, target: float | None, at: datetime) -> _Machine:
    cycles = _cycles(conn, mid, at)
    last = [c for _, c in cycles[-CYCLE_SAMPLE:]]
    day = at.replace(hour=0, minute=0, second=0, microsecond=0)
    trend = []
    for i in range(TREND_POINTS, 0, -1):
        lo, hi = at - i * TREND_BUCKET, at - (i - 1) * TREND_BUCKET
        vs = [c for t, c in cycles if lo < t <= hi]
        if vs:
            trend.append(round(sum(vs) / len(vs), 2))
    return _Machine(id=mid, cycle=round(median(last), 2) if last else None, target=target,
                    running=bool(cycles) and at - cycles[-1][0] <= RUNNING_WINDOW,
                    output=sum(1 for t, _ in cycles if t >= day), trend=trend)


def _lots_in(edges: list[TwinEdge], into: str) -> list[str]:
    return [e.from_id for e in edges if e.relation == "fed_into" and e.to_id == into]


def _consumed(conn, lot: str, at: datetime) -> int:
    return conn.execute("SELECT count(*) AS n FROM events WHERE type = 'press_cycle' AND payload->>'lot' = %s"
                        " AND event_time <= %s", (lot, at)).fetchone()["n"]


def _fmt(v: float | None) -> str:
    """Seconds as `42 s`, or `—` when there is no value."""
    return "—" if v is None else f"{v:.0f} s"


class _Snapshot(BaseModel):
    assets: dict[str, dict[str, Any]]
    edges: list[TwinEdge]
    machines: dict[str, _Machine]
    alerts: set[str]
    watched: set[str]
    open_alerts: int
    open_4m: int


def _snapshot(conn, at: datetime) -> _Snapshot:
    assets = _assets(conn)
    notices = _open_notices(conn, at)
    machines = {mid: _machine(conn, mid, a.get("cycle_target_s"), at) for mid, a in assets.items() if a["type"] == "machine"}
    return _Snapshot(
        assets=assets, edges=_edges(conn, list(assets), at), machines=machines,
        alerts={o for n in notices if n["kind"] == "alert" for o in n["object_ids"]},
        watched={o for n in notices if n["kind"] == "4m_change" for o in n["object_ids"]},
        open_alerts=sum(n["kind"] == "alert" for n in notices), open_4m=sum(n["kind"] == "4m_change" for n in notices))


def _line_of(snap: _Snapshot) -> dict[str, str]:
    """machine/hopper → line, from `part_of` links (falling back to the machine's `line` attribute)."""
    out = {e.from_id: e.to_id for e in snap.edges if e.relation == "part_of" and snap.assets.get(e.to_id, {}).get("type") == "line"}
    for mid, a in snap.assets.items():
        if a["type"] == "machine" and a.get("line"):
            out.setdefault(mid, a["line"])
    return out


def _machine_lot(snap: _Snapshot, mid: str) -> str | None:
    hoppers = [e.from_id for e in snap.edges if e.relation == "fed_into" and e.to_id == mid
               and snap.assets.get(e.from_id, {}).get("type") == "hopper"]
    lots = [lot for h in hoppers for lot in _lots_in(snap.edges, h)]
    return ", ".join(lots) or None


def _machine_state(snap: _Snapshot, m: _Machine) -> State:
    if m.id in snap.alerts:
        return "warning"
    if m.id in snap.watched:
        return "watch4m"
    return "running" if m.running else "stopped"


def _line_state(states: list[State]) -> State:
    for s in ("warning", "watch4m", "running"):
        if s in states:
            return s  # type: ignore[return-value]
    return "stopped"


# ---------------------------------------------------------------- endpoints

def plant_state(conn: psycopg.Connection, at: datetime) -> PlantState:
    snap = _snapshot(conn, at)
    line_of = _line_of(snap)
    nodes: dict[str, NodeState] = {}
    for oid, a in snap.assets.items():
        t = a["type"]
        watch = "watch4m" if oid in snap.watched else None
        if t == "machine":
            m = snap.machines[oid]
            nodes[oid] = NodeState(state=_machine_state(snap, m), value=f"{_fmt(m.cycle)} / {_fmt(m.target)}")
        elif t == "lot":
            used = _consumed(conn, oid, at)
            in_use = any(e.relation == "fed_into" and e.from_id == oid for e in snap.edges)
            value = f"{a['qty'] - used:,} pcs" if a.get("qty") else f"{used:,} used"
            nodes[oid] = NodeState(state=watch or ("running" if in_use else "idle"), value=value)
        elif t == "hopper":
            lots = _lots_in(snap.edges, oid)
            nodes[oid] = NodeState(state=watch or ("running" if lots else "idle"), value=", ".join(lots) or "empty")
        elif t == "line":
            ms = [snap.machines[mid] for mid, line in line_of.items() if line == oid and mid in snap.machines]
            cycle = max((m.cycle for m in ms if m.cycle is not None), default=None)
            nodes[oid] = NodeState(state=_line_state([_machine_state(snap, m) for m in ms]),
                                   value=f"{sum(m.output for m in ms):,} pcs · {_fmt(cycle)}", sub=a.get("product"))
        elif t == "shipment":
            nodes[oid] = NodeState(state=watch or "idle",
                                   value=" · ".join(str(x) for x in (a.get("status"), a.get("date")) if x))
        elif t == "inspection":
            nodes[oid] = NodeState(state=watch or "idle", value=f"Cpk {a['cpk']}" if a.get("cpk") is not None else "")
        else:  # receipt
            nodes[oid] = NodeState(state=watch or "idle", value=str(a.get("received_at", ""))[:10])
    return PlantState(at=at, nodes=nodes, edges=snap.edges)


def _shipment_risks(conn, assets: dict[str, dict[str, Any]]) -> list[ShipmentRisk]:
    bad = conn.execute(
        """SELECT o.object_id AS insp, o.attributes->>'lot' AS lot, (o.attributes->>'cpk')::float AS cpk,
                  (o.attributes->>'spec_min')::float AS spec
           FROM objects o WHERE o.type = 'inspection' AND (o.attributes->>'cpk')::float < (o.attributes->>'spec_min')::float
           ORDER BY o.object_id""").fetchall()
    reasons: dict[str, str] = {}
    for b in bad:
        if not b["lot"] or b["lot"] not in assets:
            continue
        for s in trace_forward(conn, b["lot"]).shipments:
            reasons.setdefault(s.id, f"{s.parts} parts from {b['lot']} (IQC {b['insp']} Cpk {b['cpk']} < {b['spec']})")
    out = []
    for sid, a in assets.items():
        if a["type"] != "shipment":
            continue
        out.append(ShipmentRisk(id=sid, status=a.get("status"), date=a.get("date"), customer=a.get("customer"),
                                parts=int(a.get("parts") or 0), risk="high" if sid in reasons else "none",
                                reason=reasons.get(sid, "")))
    return sorted(out, key=lambda s: (s.date or "9999", s.id))


def _sources(conn, at: datetime) -> list[SourceRow]:
    rows = conn.execute(
        """SELECT source, count(*) AS n, max(t) AS last_at FROM (
               SELECT source, CASE WHEN event_time <= %(at)s THEN event_time END AS t FROM events
               UNION ALL SELECT source, CASE WHEN effective_from <= %(at)s THEN effective_from END FROM documents
           ) x WHERE source IS NOT NULL GROUP BY source ORDER BY source""", {"at": at}).fetchall()
    delay = {r["source"]: r["offset_s"] for r in conn.execute("SELECT source, offset_s FROM time_mappings")}
    return [SourceRow(source=r["source"], dept=dept_of_source(r["source"]), events=r["n"], last_at=r["last_at"],
                      delay_s=delay.get(r["source"])) for r in rows]


def plant_overview(conn: psycopg.Connection, at: datetime) -> PlantOverview:
    snap = _snapshot(conn, at)
    line_of = _line_of(snap)
    rows: list[OverviewRow] = []
    for lid, a in snap.assets.items():
        if a["type"] != "line":
            continue
        ms = [snap.machines[mid] for mid in sorted(snap.machines) if line_of.get(mid) == lid]
        cycle = max((m.cycle for m in ms if m.cycle is not None), default=None)
        target = max((m.target for m in ms if m.target is not None), default=None)
        rows.append(OverviewRow(id=lid, kind="line", name=a["name"], line=None,
                                state=_line_state([_machine_state(snap, m) for m in ms]), cycle_s=cycle,
                                target_s=target, output=sum(m.output for m in ms), lot=None, trend=[]))
        rows += [OverviewRow(id=m.id, kind="machine", name=snap.assets[m.id]["name"], line=lid,
                             state=_machine_state(snap, m), cycle_s=m.cycle, target_s=m.target, output=m.output,
                             lot=_machine_lot(snap, m.id), trend=m.trend) for m in ms]
    ms = [m for m in snap.machines.values() if m.output]
    weight = sum(m.output for m in ms)
    kpis = Kpis(
        output=sum(m.output for m in snap.machines.values()),
        cycle_s=round(sum((m.cycle or 0) * m.output for m in ms) / weight, 1) if weight else None,
        target_s=round(sum((m.target or 0) * m.output for m in ms) / weight, 1) if weight else None,
        open_alerts=snap.open_alerts, watch_4m=snap.open_4m,
        pending_links=conn.execute("SELECT count(*) AS n FROM links WHERE status = ANY(%s)",
                                   (list(REVIEWABLE),)).fetchone()["n"])
    return PlantOverview(at=at, kpis=kpis, rows=rows, shipments=_shipment_risks(conn, snap.assets),
                         sources=_sources(conn, at))
