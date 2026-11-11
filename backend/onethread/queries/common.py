from datetime import timedelta, timezone
from typing import Any

import psycopg

PLANT_TZ = timezone(timedelta(hours=7))
SKIP_TYPES = {"serial", "box"}  # volume nodes never shown in a thread (except the root)


class NotFound(Exception):
    def __init__(self, kind: str, id: str):
        super().__init__(f"{kind} {id} not found")
        self.kind, self.id = kind, id


def ensure_exists(conn: psycopg.Connection, id: str, kind: str = "object") -> None:
    row = conn.execute(
        "SELECT 1 FROM objects WHERE object_id = %s UNION ALL SELECT 1 FROM documents WHERE doc_id = %s LIMIT 1",
        (id, id),
    ).fetchone()
    if row is None:
        raise NotFound(kind, id)


def node_info(conn: psycopg.Connection, ids: set[str] | list[str]) -> dict[str, dict[str, Any]]:
    """id -> {type, name, attributes} for objects and documents (documents get type 'document')."""
    ids = list(ids)
    info: dict[str, dict[str, Any]] = {}
    if not ids:
        return info
    for r in conn.execute("SELECT object_id, type, name, attributes FROM objects WHERE object_id = ANY(%s)", (ids,)):
        info[r["object_id"]] = {"type": r["type"], "name": r["name"], "attributes": r["attributes"]}
    for r in conn.execute(
        "SELECT DISTINCT ON (doc_id) doc_id, type, source, page, file_uri FROM documents"
        " WHERE doc_id = ANY(%s) ORDER BY doc_id, chunk_id",
        (ids,),
    ):
        info.setdefault(
            r["doc_id"],
            {
                "type": "document",
                "name": f"{r['type']} p.{r['page']}",
                "attributes": {"doc_type": r["type"], "source": r["source"], "page": r["page"],
                               "file_uri": r["file_uri"]},
            },
        )
    return info


def bfs(conn: psycopg.Connection, root: str, max_depth: int) -> tuple[dict[str, int], dict[str, dict[str, Any]]]:
    """Undirected BFS over links from `root`; serial/box nodes (other than the root) are neither
    returned nor expanded. Returns (depth by id, node info by id)."""
    nodes = node_info(conn, [root])
    depth = {root: 0}
    frontier = [root]
    for d in range(1, max_depth + 1):
        if not frontier:
            break
        rows = conn.execute(
            "SELECT from_id, to_id FROM links WHERE from_id = ANY(%s) OR to_id = ANY(%s)", (frontier, frontier)
        ).fetchall()
        candidates = {x for r in rows for x in (r["from_id"], r["to_id"])} - depth.keys()
        info = node_info(conn, candidates)
        frontier = []
        for cid in sorted(candidates):
            i = info.get(cid)
            if i is None or i["type"] in SKIP_TYPES:
                continue
            depth[cid], nodes[cid] = d, i
            frontier.append(cid)
    return depth, nodes
