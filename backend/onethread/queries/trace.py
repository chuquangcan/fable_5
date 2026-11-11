from typing import Any

from pydantic import BaseModel

from onethread.queries.common import NotFound, bfs, node_info


class Node(BaseModel):
    id: str
    type: str
    name: str
    attributes: dict[str, Any] = {}


class Edge(BaseModel):
    from_id: str
    to_id: str
    relation: str
    tier: int
    status: str
    score: float | None = None


class TraceGraph(BaseModel):
    root: str
    nodes: list[Node]
    edges: list[Edge]


def trace_serial(conn, serial: str, max_depth: int = 5) -> TraceGraph:
    if serial not in node_info(conn, [serial]):
        raise NotFound("serial", serial)
    depth, info = bfs(conn, serial, max_depth)
    ids = list(depth)
    rows = conn.execute(
        "SELECT from_id, to_id, relation, tier, status, score FROM links"
        " WHERE from_id = ANY(%s) AND to_id = ANY(%s) ORDER BY link_id",
        (ids, ids),
    ).fetchall()
    ordered = sorted(ids, key=lambda i: (depth[i], i))
    return TraceGraph(
        root=serial,
        nodes=[Node(id=i, **info[i]) for i in ordered],
        edges=[Edge(**r) for r in rows],
    )
