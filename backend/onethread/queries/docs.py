from datetime import datetime

from pydantic import BaseModel

from onethread.queries.common import ensure_exists
from onethread.queries.common import bfs


class DocView(BaseModel):
    doc_id: str
    page: int | None = None
    type: str
    text: str
    extracted_codes: list[str] = []
    tier: int
    status: str
    score: float | None = None


def get_docs(conn, object_id: str, at: datetime | None = None, hops: int = 2) -> list[DocView]:
    ensure_exists(conn, object_id)
    depth, info = bfs(conn, object_id, hops)
    doc_ids = [i for i, n in info.items() if n["type"] == "document"]
    if not doc_ids:
        return []
    # tier/status come from the link that connects the doc to the closest node of the thread
    links = conn.execute(
        "SELECT from_id, to_id, tier, status, score FROM links"
        " WHERE (from_id = ANY(%(d)s) AND to_id = ANY(%(n)s)) OR (to_id = ANY(%(d)s) AND from_id = ANY(%(n)s))"
        " ORDER BY link_id",
        {"d": doc_ids, "n": list(depth)},
    ).fetchall()
    best: dict[str, dict] = {}
    for l in links:
        doc, other = (l["from_id"], l["to_id"]) if l["from_id"] in doc_ids else (l["to_id"], l["from_id"])
        if other in doc_ids:
            continue
        key = (depth[other], -(l["score"] or 0))
        if doc not in best or key < best[doc][0]:
            best[doc] = (key, l)
    chunks = conn.execute(
        """SELECT doc_id, page, type, text, extracted_codes FROM documents
           WHERE doc_id = ANY(%(d)s) AND (%(at)s::timestamptz IS NULL OR effective_from <= %(at)s)
           ORDER BY doc_id, chunk_id""",
        {"d": doc_ids, "at": at},
    ).fetchall()
    out = []
    for c in chunks:
        if c["doc_id"] in best:
            l = best[c["doc_id"]][1]
            out.append(DocView(**c, tier=l["tier"], status=l["status"], score=l["score"]))
    return sorted(out, key=lambda d: (d.tier, d.doc_id))
