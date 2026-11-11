"""Flow bible (spec 3.3): direction of material flow per relation, validity windows, alias merge.

Shared by the flow graph, node summary and fault trace. Only confirmed/inferred links are flow.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import psycopg

# Relations whose upstream end is `to` (link reads against the flow) vs. `from` (reads with it).
UP_IS_TO = {"supplied_by", "received_under", "processed_on", "uses_lot", "raised_by"}
UP_IS_FROM = {"fed_into", "packed_in", "shipped_in", "ordered_in", "delivered_to"}
# Every other relation (about, inspected, part_of, same_as, ...) is an attachment, not flow.

FLOW_STATUSES = ("confirmed", "inferred")


@dataclass(frozen=True)
class DirectedEdge:
    up: str
    down: str
    relation: str
    link_id: int
    tier: int
    status: str
    shortcut: bool
    active: bool
    evidence: dict


def _alias_map(rows: list[dict[str, Any]]) -> dict[str, str]:
    """Every `to` of a same_as link maps to its `from` (S1-6203-B -> LOT-B)."""
    return {r["to_id"]: r["from_id"] for r in rows if r["relation"] == "same_as"}


def _is_active(evidence: dict, at: datetime | None) -> bool:
    if at is None:
        return True
    valid_from, valid_to = evidence.get("valid_from"), evidence.get("valid_to")
    if valid_from is not None and datetime.fromisoformat(valid_from) > at:
        return False
    if valid_to is not None and at >= datetime.fromisoformat(valid_to):
        return False
    return True


def flow_edges(conn: psycopg.Connection, at: datetime | None = None, *,
               include_inactive: bool = False) -> list[DirectedEdge]:
    """Directed (upstream -> downstream) flow edges, aliases merged.

    `active` holds when evidence.valid_from <= at < evidence.valid_to (missing bounds are open);
    with `at=None` every edge is active. Only active edges are returned unless `include_inactive`.
    """
    rows = conn.execute(
        """SELECT l.link_id, l.from_id, l.to_id, l.relation, l.tier, l.status, l.evidence,
                  o.type AS from_type
           FROM links l LEFT JOIN objects o ON o.object_id = l.from_id
           WHERE l.status = ANY(%s) AND l.relation = ANY(%s)
           ORDER BY l.link_id""",
        (list(FLOW_STATUSES), sorted(UP_IS_TO | UP_IS_FROM | {"same_as"})),
    ).fetchall()
    alias = _alias_map(rows)
    edges: list[DirectedEdge] = []
    for r in rows:
        rel = r["relation"]
        if rel == "same_as":
            continue
        up, down = (r["to_id"], r["from_id"]) if rel in UP_IS_TO else (r["from_id"], r["to_id"])
        evidence = r["evidence"] or {}
        active = _is_active(evidence, at)
        if not active and not include_inactive:
            continue
        shortcut = (
            rel == "uses_lot"
            or (rel == "shipped_in" and r["from_type"] == "serial")
            or (rel == "supplied_by" and r["from_type"] == "supplier_lot")
        )
        edges.append(DirectedEdge(
            up=alias.get(up, up), down=alias.get(down, down), relation=rel, link_id=r["link_id"],
            tier=r["tier"], status=r["status"], shortcut=shortcut, active=active, evidence=evidence,
        ))
    return edges


def collapse_map(conn: psycopg.Connection, keep: set[str]) -> dict[str, str]:
    """Map every serial/box not in `keep` to its lot's aggregate node `AGG-{lot}`.

    A serial's lot comes from `uses_lot`; a box's lot from the first serial (by id) packed in it.
    """
    statuses = list(FLOW_STATUSES)
    alias = {r["to_id"]: r["from_id"] for r in conn.execute(
        "SELECT from_id, to_id FROM links WHERE relation = 'same_as' AND status = ANY(%s)", (statuses,))}
    serial_lot = {r["serial"]: r["lot"] for r in conn.execute(
        """SELECT DISTINCT ON (o.object_id) o.object_id AS serial, l.to_id AS lot
           FROM objects o JOIN links l ON l.from_id = o.object_id
           WHERE o.type = 'serial' AND l.relation = 'uses_lot' AND l.status = ANY(%s)
           ORDER BY o.object_id, l.link_id""",
        (statuses,),
    )}
    box_serial = {r["box"]: r["serial"] for r in conn.execute(
        """SELECT DISTINCT ON (o.object_id) o.object_id AS box, l.from_id AS serial
           FROM objects o JOIN links l ON l.to_id = o.object_id
           WHERE o.type = 'box' AND l.relation = 'packed_in' AND l.status = ANY(%s)
           ORDER BY o.object_id, l.from_id""",
        (statuses,),
    )}
    lot_of = dict(serial_lot)
    lot_of.update({box: serial_lot[s] for box, s in box_serial.items() if s in serial_lot})
    return {node: f"AGG-{alias.get(lot, lot)}" for node, lot in lot_of.items() if node not in keep}
