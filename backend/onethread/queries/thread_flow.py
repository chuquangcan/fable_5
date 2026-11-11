"""Straight material-flow thread (spec 3.3, DEMO-17): one spine row through the root serial,
side branches below it, and non-flow context folded into per-node attachments."""

from collections import Counter
from datetime import datetime
from typing import Any, Literal

import psycopg
from pydantic import BaseModel

from onethread.flow import UP_IS_FROM, UP_IS_TO, DirectedEdge, collapse_map, flow_edges
from onethread.queries.common import PLANT_TZ, SKIP_TYPES, NotFound, node_info, press_time

BRANCH_DEPTH = 4
# Attachment kind by the attached object's type; other types (e.g. line) are not attachments.
ATTACH_KIND = {"document": "document", "inspection": "inspection", "claim": "claim",
               "supplier_lot": "alias", "part": "part"}
SINGLE_EVENTS = ("maintenance", "shift", "lot_loaded", "goods_receipt")  # one attachment per event
GROUPED_EVENTS = ("press_cycle", "env_temp")                              # one attachment per source
# serial/box carry no `stage` attribute; the aggregate sits in the serial column.
DEFAULT_STAGE = {"serial": "san_xuat", "box": "logistics", "aggregate": "san_xuat"}


class FlowNode(BaseModel):
    id: str
    type: str
    name: str
    stage: str
    sub: str
    order: int | None   # column: spine index; a branch takes the index of the spine column it sits under
    row: int            # 0 = spine, 1.. = branch rows under that column
    parent_id: str | None = None
    members: dict | None = None


class FlowEdge(BaseModel):
    up: str
    down: str
    relation: str
    tier: int
    status: str
    kind: Literal["spine", "branch"]
    active: bool


class Attachment(BaseModel):
    id: str
    kind: Literal["document", "inspection", "claim", "event", "alias", "part"]
    label: str
    status: str | None = None
    tier: int | None = None
    via: str | None = None


class FlowGraph(BaseModel):
    root: str
    at: datetime
    spine: list[FlowNode]
    branches: list[FlowNode]
    edges: list[FlowEdge]
    attachments: dict[str, list[Attachment]]


def resolve_serial(conn: psycopg.Connection, id: str) -> str:
    info = node_info(conn, [id]).get(id)
    if info is not None and info["type"] == "claim":
        id = (info["attributes"] or {}).get("serial") or ""
        info = node_info(conn, [id]).get(id) if id else None
    if info is None or info["type"] != "serial":
        raise NotFound("serial or claim", id)
    return id


def _spine(conn: psycopg.Connection, root: str, edges: list[DirectedEdge]) -> list[str]:
    ups: dict[str, list[DirectedEdge]] = {}
    downs: dict[str, list[DirectedEdge]] = {}
    for e in sorted(edges, key=lambda e: e.link_id):
        ups.setdefault(e.down, []).append(e)
        downs.setdefault(e.up, []).append(e)
    claims_of_root = {r["from_id"] for r in conn.execute(
        "SELECT from_id FROM links WHERE relation = 'about' AND to_id = %s", (root,))}

    seen = {root}
    up: list[str] = []
    node = root
    while cands := [e for e in ups.get(node, []) if e.up not in seen]:
        node = cands[0].up                     # smallest link_id
        seen.add(node)
        up.append(node)

    down: list[str] = []
    node = root
    while cands := [e for e in downs.get(node, []) if e.down not in seen]:
        node = min(cands, key=lambda e: (e.down not in claims_of_root, e.link_id)).down
        seen.add(node)
        down.append(node)
    return [*reversed(up), root, *down]


def _branches(spine: list[str], adj: dict[str, set[str]]) -> tuple[list[str], dict[str, str]]:
    """Undirected BFS from every spine node; returns branch ids in discovery order and parents."""
    seen = set(spine)
    order: list[str] = []
    parent: dict[str, str] = {}
    frontier = list(spine)
    for _ in range(BRANCH_DEPTH):
        nxt: list[str] = []
        for node in frontier:
            for nb in sorted(adj.get(node, ())):
                if nb not in seen:
                    seen.add(nb)
                    parent[nb] = node
                    order.append(nb)
                    nxt.append(nb)
        frontier = nxt
    return order, parent


def _fmt(t: datetime | str | None, pattern: str) -> str:
    if t is None:
        return ""
    if isinstance(t, str):
        t = datetime.fromisoformat(t)
    return t.astimezone(PLANT_TZ).strftime(pattern) if t.tzinfo else t.strftime(pattern)


def _subs(conn: psycopg.Connection, info: dict[str, dict[str, Any]]) -> dict[str, str]:
    ids = list(info)
    attrs = {i: info[i]["attributes"] or {} for i in ids}
    refs = {a.get(k) for a in attrs.values() for k in ("part", "line") if a.get(k)}
    customer_of = {r["from_id"]: r["to_id"] for r in conn.execute(
        "SELECT from_id, to_id FROM links WHERE relation = 'delivered_to' AND from_id = ANY(%s)"
        " ORDER BY link_id DESC", (ids,))}
    refs |= set(customer_of.values())
    names = {k: v["name"] for k, v in node_info(conn, refs).items()}
    received = {}
    for r in conn.execute(
        "SELECT source_record_id, object_ids, event_time FROM events WHERE type = 'goods_receipt'"
        " ORDER BY event_time"):
        for k in (r["source_record_id"], *r["object_ids"]):
            received.setdefault(k, r["event_time"])
    pressed = {r["o"]: r["t"] for r in conn.execute(
        "SELECT o, min(event_time) AS t FROM events, unnest(object_ids) AS o"
        " WHERE type = 'press_cycle' AND o = ANY(%s) GROUP BY o", (ids,))}
    box_parts = {r["to_id"]: r["n"] for r in conn.execute(
        "SELECT to_id, count(*) AS n FROM links WHERE relation = 'packed_in' AND to_id = ANY(%s)"
        " GROUP BY to_id", (ids,))}

    out: dict[str, str] = {}
    for i in ids:
        t, a = info[i]["type"], attrs[i]
        match t:
            case "supplier":
                out[i] = f"ERP: {a.get('erp_code', '')}"
            case "purchase_order":
                out[i] = f"{a['qty']:,} pcs" if a.get("qty") is not None else ""
            case "receipt":
                out[i] = f"nhập {_fmt(received.get(i) or a.get('received_at'), '%m-%d %H:%M')}"
            case "lot":
                part = names.get(a.get("part"), a.get("part", ""))
                out[i] = f"{part} · {a['qty']:,}" if a.get("qty") is not None else part
            case "hopper":
                out[i] = "cấp liệu"
            case "machine":
                out[i] = names.get(a.get("line"), a.get("line", ""))
            case "serial":
                out[i] = f"ép {_fmt(pressed.get(i), '%m-%d %H:%M')}"
            case "box":
                out[i] = f"{box_parts.get(i, 0)} part"
            case "shipment":
                out[i] = f"giao {_fmt(a['date'], '%m-%d')}" if a.get("date") else "trong kho"
            case "sales_order":
                out[i] = names.get(customer_of.get(i), a.get("customer", ""))
            case "customer":
                out[i] = info[i]["name"]
            case "claim":
                out[i] = f"nhận {_fmt(a['received'], '%m-%d')}" if a.get("received") else ""
            case _:
                out[i] = ""
    return out


def _attachments(conn: psycopg.Connection, nodes: list[str], shown: set[str],
                 info: dict[str, dict[str, Any]]) -> dict[str, list[Attachment]]:
    flow_rel = sorted(UP_IS_TO | UP_IS_FROM)
    rows = conn.execute(
        "SELECT from_id, to_id, relation, tier, status FROM links"
        " WHERE NOT (relation = ANY(%s)) ORDER BY link_id", (flow_rel,)).fetchall()
    nbrs: dict[str, list[tuple[str, dict]]] = {}
    for r in rows:
        nbrs.setdefault(r["from_id"], []).append((r["to_id"], r))
        nbrs.setdefault(r["to_id"], []).append((r["from_id"], r))
    level1 = {o for n in nodes for o, _ in nbrs.get(n, [])}
    level2 = {o for x in level1 for o, _ in nbrs.get(x, [])}
    other_info = node_info(conn, (level1 | level2) - info.keys())
    all_info = {**info, **other_info}

    def attachable(o: str) -> str | None:
        i = all_info.get(o)
        if o in shown or i is None or i["type"] in SKIP_TYPES:
            return None
        return ATTACH_KIND.get(i["type"])

    out: dict[str, dict[str, Attachment]] = {n: {} for n in nodes}
    for n in nodes:
        acc = out[n]
        for o, r in nbrs.get(n, []):
            if (kind := attachable(o)) is None or o in acc:
                continue
            acc[o] = Attachment(id=o, kind=kind, label=all_info[o]["name"], status=r["status"], tier=r["tier"])
            for o2, r2 in nbrs.get(o, []):
                if o2 != n and o2 not in acc and (kind2 := attachable(o2)) is not None:
                    acc[o2] = Attachment(id=o2, kind=kind2, label=all_info[o2]["name"],
                                         status=r2["status"], tier=r2["tier"], via=o)

    # events of the node itself and of its `part_of` targets (M02 -> LINE-1 -> ENV-L1)
    part_of = {(r["from_id"], r["to_id"]) for r in rows if r["relation"] == "part_of" and r["from_id"] in out}
    owners: dict[str, list[tuple[str, str | None]]] = {n: [(n, None)] for n in nodes}
    for n, target in sorted(part_of):
        owners.setdefault(target, []).append((n, target))
    for r in conn.execute(
        "SELECT o, type, source, source_record_id, event_time FROM events, unnest(object_ids) AS o"
        " WHERE o = ANY(%s) AND type = ANY(%s) ORDER BY event_time, event_id",
        (list(owners), list(SINGLE_EVENTS))):
        for n, via in owners[r["o"]]:
            if r["source_record_id"] not in shown and r["source_record_id"] not in out[n]:
                out[n][r["source_record_id"]] = Attachment(
                    id=r["source_record_id"], kind="event", via=via,
                    label=f"{r['type']} {_fmt(r['event_time'], '%m-%d %H:%M')}")
    for r in conn.execute(
        "SELECT o, type, source, count(*) AS n FROM events, unnest(object_ids) AS o"
        " WHERE o = ANY(%s) AND type = ANY(%s) GROUP BY o, type, source ORDER BY o, type, source",
        (list(owners), list(GROUPED_EVENTS))):
        for n, via in owners[r["o"]]:
            if r["source"] not in shown and r["source"] not in out[n]:
                out[n][r["source"]] = Attachment(id=r["source"], kind="event", via=via,
                                                 label=f"{r['type']} · {r['n']:,}")
    return {n: list(acc.values()) for n, acc in out.items() if acc}


def build_flow(conn: psycopg.Connection, id: str) -> FlowGraph:
    root = resolve_serial(conn, id)
    at = press_time(conn, root)

    spine = _spine(conn, root, [e for e in flow_edges(conn, at) if not e.shortcut])
    cmap = collapse_map(conn, set(spine))

    # Eall with volume collapsed; keyed (up, down, relation), first link wins, self-loops dropped.
    merged: dict[tuple[str, str, str], dict[str, Any]] = {}
    for e in flow_edges(conn, at, include_inactive=True):
        if e.shortcut:
            continue
        up, down = cmap.get(e.up, e.up), cmap.get(e.down, e.down)
        if up == down:
            continue
        m = merged.setdefault((up, down, e.relation), {"tier": e.tier, "status": e.status, "active": False})
        m["active"] = m["active"] or e.active
    adj: dict[str, set[str]] = {}
    for up, down, _ in merged:
        adj.setdefault(up, set()).add(down)
        adj.setdefault(down, set()).add(up)

    branch_ids, parent = _branches(spine, adj)
    shown = set(spine) | set(branch_ids)
    info = node_info(conn, [i for i in shown if i not in cmap.values()])

    members: dict[str, dict[str, int]] = {}
    if cmap:
        types = {r["object_id"]: r["type"] for r in conn.execute(
            "SELECT object_id, type FROM objects WHERE object_id = ANY(%s)", (list(cmap),))}
        counts = Counter((agg, types.get(src)) for src, agg in cmap.items())
        for agg in set(cmap.values()):
            members[agg] = {"parts": counts[(agg, "serial")], "boxes": counts[(agg, "box")]}
    for agg, m in members.items():
        if agg in shown:
            lot = agg.removeprefix("AGG-")
            info[agg] = {"type": "aggregate", "name": f"+{m['parts']:,} part · {lot}", "attributes": {}}

    subs = _subs(conn, {k: v for k, v in info.items() if v["type"] != "aggregate"})
    for agg, m in members.items():
        subs[agg] = f"+{m['parts']:,} part · {m['boxes']} thùng"

    def node(i: str, order: int | None, row: int, parent_id: str | None = None) -> FlowNode:
        t = info[i]["type"]
        stage = (info[i]["attributes"] or {}).get("stage") or DEFAULT_STAGE.get(t, "")
        return FlowNode(id=i, type=t, name=info[i]["name"], stage=stage, sub=subs.get(i, ""),
                        order=order, row=row, parent_id=parent_id,
                        members=members.get(i) if t == "aggregate" else None)

    spine_nodes = [node(i, k, 0) for k, i in enumerate(spine)]
    column_of_type: dict[str, int] = {}
    for n in spine_nodes:
        column_of_type.setdefault(n.type, n.order)
    column: dict[str, int] = {n.id: n.order for n in spine_nodes}
    rows_used: Counter[int] = Counter()
    branch_nodes: list[FlowNode] = []
    for i in branch_ids:
        t = info[i]["type"]
        col = column_of_type.get("serial" if t == "aggregate" else t, column[parent[i]])
        rows_used[col] += 1
        column[i] = col
        branch_nodes.append(node(i, col, rows_used[col], parent[i]))

    spine_pairs = set(zip(spine, spine[1:]))
    edges = [FlowEdge(up=up, down=down, relation=rel, tier=m["tier"], status=m["status"],
                      kind="spine" if (up, down) in spine_pairs else "branch", active=m["active"])
             for (up, down, rel), m in merged.items() if up in shown and down in shown]

    attach_nodes = [i for i in [*spine, *branch_ids] if info[i]["type"] != "aggregate"]
    attachments = _attachments(conn, attach_nodes, shown, info)
    return FlowGraph(root=root, at=at, spine=spine_nodes, branches=branch_nodes, edges=edges,
                     attachments=attachments)
