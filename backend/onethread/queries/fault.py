"""Fault trace (spec 3.3, DEMO-19): red = origin + everything upstream of it, orange = everything
downstream of a red node that is not itself red."""

from collections import deque
from datetime import datetime

import psycopg
from pydantic import BaseModel

from onethread.flow import DirectedEdge, collapse_map, flow_edges
from onethread.queries.common import PLANT_TZ, ensure_exists, node_info, press_time

DEFAULT_AT = datetime.fromisoformat("2027-02-12T09:00:00+07:00")


class Mark(BaseModel):
    id: str
    reason: str


class FaultTrace(BaseModel):
    origin: str
    at: datetime
    red: list[Mark]
    orange: list[Mark]


def _resolve_origin(conn: psycopg.Connection, origin: str) -> tuple[str, bool]:
    """(origin id, is_serial). A claim whose attributes.serial is an object resolves to that serial."""
    ensure_exists(conn, origin)
    info = node_info(conn, [origin])[origin]
    if info["type"] == "claim":
        serial = (info["attributes"] or {}).get("serial")
        if serial and (s := node_info(conn, [serial]).get(serial)) is not None and s["type"] == "serial":
            return serial, True
        return origin, False
    return origin, info["type"] == "serial"


def fault_trace(conn: psycopg.Connection, origin: str, at: datetime | None = None) -> FaultTrace:
    origin, is_serial = _resolve_origin(conn, origin)
    if at is None:
        at = press_time(conn, origin) if is_serial else DEFAULT_AT
    elif at.tzinfo is None:
        at = at.replace(tzinfo=PLANT_TZ)

    keep = {origin}
    if is_serial:
        keep |= {r["to_id"] for r in conn.execute(
            "SELECT to_id FROM links WHERE relation = 'packed_in' AND from_id = %s", (origin,))}
    cmap = collapse_map(conn, keep)

    pairs: list[tuple[str, str, DirectedEdge]] = []
    for e in flow_edges(conn, at):
        up, down = cmap.get(e.up, e.up), cmap.get(e.down, e.down)
        if up != down:
            pairs.append((up, down, e))
    pairs.sort(key=lambda p: p[2].link_id)
    ups: dict[str, list[tuple[str, DirectedEdge]]] = {}
    downs: dict[str, list[tuple[str, DirectedEdge]]] = {}
    for up, down, e in pairs:
        ups.setdefault(down, []).append((up, e))
        downs.setdefault(up, []).append((down, e))

    red: dict[str, str] = {origin: "điểm lỗi"}
    queue = deque([origin])
    while queue:
        child = queue.popleft()
        for up, e in ups.get(child, []):
            if up not in red:
                reason = f"thượng nguồn của {child} qua {e.relation}"
                if record := e.evidence.get("record"):
                    reason += f" ({record})"
                red[up] = reason
                queue.append(up)

    orange: dict[str, str] = {}
    seen = set(red)
    queue = deque(sorted(red))
    source = {r: r for r in red}
    while queue:
        node = queue.popleft()
        for down, _ in downs.get(node, []):
            if down not in seen:
                seen.add(down)
                source[down] = source[node]
                orange[down] = f"hạ nguồn của {source[node]}"
                queue.append(down)

    types = {i: v["type"] for i, v in node_info(conn, list(orange)).items()}
    return FaultTrace(
        origin=origin, at=at,
        red=[Mark(id=i, reason=red[i]) for i in sorted(red)],
        orange=[Mark(id=i, reason=r) for i, r in sorted(orange.items()) if types.get(i) != "claim"],
    )


def claim_fault_trace(conn: psycopg.Connection, claim_id: str) -> FaultTrace:
    return fault_trace(conn, claim_id)
