"""Human review of machine links (doc -> node and other non-confirmed links).

approve: the link becomes `confirmed` (tier unchanged: the tier says how the link was found, not who checked it).
reject:  the link row is deleted, so every read path (flow, docs, trace, agent tools) stops seeing it.
Each decision is logged in `link_reviews` with a snapshot of the link, which is what `reset_reviews` restores.
"""
from datetime import datetime
from typing import Literal

from fastapi import HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from onethread import config
from onethread.queries.common import node_info

REVIEWABLE = ("inferred", "pending", "suggested")
REVIEWER = "QA engineer (demo)"
MAX_NOTE = 500

Decision = Literal["approve", "reject"]


class ReviewItem(BaseModel):
    link_id: int
    from_id: str
    from_name: str
    from_type: str
    to_id: str
    to_name: str
    to_type: str
    relation: str
    tier: int
    status: str
    score: float | None = None
    method: str | None = None
    reason: str | None = None
    doc_id: str | None = None  # the document end of the link, if any


class ReviewRecord(BaseModel):
    review_id: int
    link_id: int
    decision: Decision
    from_status: str
    reviewer: str
    note: str | None = None
    reviewed_at: datetime
    from_id: str
    to_id: str
    relation: str


class ReviewQueue(BaseModel):
    pending: list[ReviewItem]
    decided: list[ReviewRecord]


_LINK_COLS = "link_id, from_id, to_id, relation, tier, status, score, rule_version, evidence"


def _items(conn, rows: list[dict]) -> list[ReviewItem]:
    info = node_info(conn, {x for r in rows for x in (r["from_id"], r["to_id"])})
    out = []
    for r in rows:
        f, t = info.get(r["from_id"], {}), info.get(r["to_id"], {})
        ev = r["evidence"] or {}
        doc = r["from_id"] if f.get("type") == "document" else r["to_id"] if t.get("type") == "document" else None
        out.append(ReviewItem(
            link_id=r["link_id"], from_id=r["from_id"], from_name=f.get("name", r["from_id"]),
            from_type=f.get("type", "?"), to_id=r["to_id"], to_name=t.get("name", r["to_id"]),
            to_type=t.get("type", "?"), relation=r["relation"], tier=r["tier"], status=r["status"],
            score=r["score"], method=ev.get("method"), reason=ev.get("reason"), doc_id=doc,
        ))
    return out


def links_of(conn, ids: list[str]) -> list[ReviewItem]:
    """Every link touching any of `ids` (any status), as review items."""
    rows = conn.execute(
        f"SELECT {_LINK_COLS} FROM links WHERE from_id = ANY(%(i)s) OR to_id = ANY(%(i)s) ORDER BY tier, link_id",
        {"i": ids}).fetchall()
    return _items(conn, rows)


def history(conn, ids: list[str] | None = None) -> list[ReviewRecord]:
    rows = conn.execute(
        """SELECT review_id, link_id, decision, from_status, reviewer, note, reviewed_at,
                  snapshot->>'from_id' AS from_id, snapshot->>'to_id' AS to_id, snapshot->>'relation' AS relation
           FROM link_reviews
           WHERE %(i)s::text[] IS NULL OR snapshot->>'from_id' = ANY(%(i)s) OR snapshot->>'to_id' = ANY(%(i)s)
           ORDER BY review_id DESC""",
        {"i": ids}).fetchall()
    return [ReviewRecord(**r) for r in rows]


def review_queue(conn) -> ReviewQueue:
    rows = conn.execute(
        f"SELECT {_LINK_COLS} FROM links WHERE status = ANY(%s) ORDER BY tier DESC, score DESC NULLS LAST, link_id",
        (list(REVIEWABLE),)).fetchall()
    return ReviewQueue(pending=_items(conn, rows), decided=history(conn))


def review_link(conn, link_id: int, decision: Decision, note: str | None = None) -> ReviewRecord:
    note = (note or "").strip()[:MAX_NOTE] or None
    with conn.transaction():
        row = conn.execute(f"SELECT {_LINK_COLS} FROM links WHERE link_id = %s FOR UPDATE", (link_id,)).fetchone()
        if row is None:
            raise HTTPException(404, f"link {link_id} not found")
        if row["status"] not in REVIEWABLE:
            raise HTTPException(409, f"link {link_id} is {row['status']}; only {', '.join(REVIEWABLE)} can be reviewed")
        snapshot = {k: row[k] for k in ("from_id", "to_id", "relation", "tier", "status", "score", "rule_version")}
        snapshot["evidence"] = row["evidence"]
        if decision == "approve":
            conn.execute("UPDATE links SET status = 'confirmed' WHERE link_id = %s", (link_id,))
        else:
            conn.execute("DELETE FROM links WHERE link_id = %s", (link_id,))
        rec = conn.execute(
            """INSERT INTO link_reviews (link_id, decision, from_status, reviewer, note, reviewed_at, snapshot)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING review_id, link_id, decision, from_status, reviewer, note, reviewed_at""",
            (link_id, decision, row["status"], REVIEWER, note, config.DEMO_NOW, Jsonb(snapshot))).fetchone()
    return ReviewRecord(**rec, from_id=row["from_id"], to_id=row["to_id"], relation=row["relation"])


def reset_reviews(conn) -> int:
    """Undo every review, newest first: approvals get their old status back, rejected links are re-inserted."""
    with conn.transaction():
        rows = conn.execute(
            "SELECT review_id, link_id, decision, from_status, snapshot FROM link_reviews ORDER BY review_id DESC"
        ).fetchall()
        for r in rows:
            s = r["snapshot"]
            if r["decision"] == "approve":
                conn.execute("UPDATE links SET status = %s WHERE link_id = %s", (r["from_status"], r["link_id"]))
            elif conn.execute("SELECT 1 FROM links WHERE link_id = %s", (r["link_id"],)).fetchone() is None:
                conn.execute(
                    "INSERT INTO links (link_id, from_id, to_id, relation, tier, status, score, rule_version, evidence)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (r["link_id"], s["from_id"], s["to_id"], s["relation"], s["tier"], s["status"], s["score"],
                     s["rule_version"], Jsonb(s["evidence"])))
        conn.execute("DELETE FROM link_reviews")
    return len(rows)
