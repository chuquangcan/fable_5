"""The left rail's "Notifications & changes" feed: alerts, 4M changes, documents read by AI, links waiting for
review and customer claims, merged into one typed list (newest first) with sender and acting departments."""
from calendar import monthrange
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from onethread import review
from onethread.departments import dept_of_source, dept_of_stage
from onethread.queries import claims, repository
from onethread.queries.common import PLANT_TZ

# The demo clock (spec §6): the twin and overview show the plant as of this time unless a card moves it.
DEFAULT_AS_OF = datetime(2026, 11, 3, 14, 5, tzinfo=PLANT_TZ)

Kind = Literal["alert", "4m", "doc", "link", "claim"]
Status = Literal["proposed", "watching", "approved", "closed"]


class FeedRef(BaseModel):
    doc_id: str | None = None
    link_id: int | None = None
    claim_id: str | None = None


class FeedItem(BaseModel):
    id: str
    kind: Kind
    badge: str
    at: datetime
    title: str
    reason: str
    sender: str | None
    acting: list[str]
    objects: list[str]
    status: Status
    ref: FeedRef

    @field_validator("at")
    @classmethod
    def _plant_time(cls, v: datetime) -> datetime:  # one offset, so ISO strings sort like the times they hold
        return v.astimezone(PLANT_TZ)


def _stage_depts(conn, ids: list[str]) -> dict[str, str]:
    rows = conn.execute("SELECT object_id, attributes->>'stage' AS stage FROM objects WHERE object_id = ANY(%s)",
                        (ids,)).fetchall()
    return {r["object_id"]: d for r in rows if (d := dept_of_stage(r["stage"]))}


def _uniq(xs) -> list[str]:
    return list(dict.fromkeys(x for x in xs if x))


def _notices(conn) -> list[FeedItem]:
    rows = conn.execute("SELECT * FROM notices").fetchall()
    return [FeedItem(
        id=n["notice_id"], kind="alert" if n["kind"] == "alert" else "4m",
        badge=(n["severity"] or "P3") if n["kind"] == "alert" else "4M", at=n["at"], title=n["title"],
        reason=n["reason"], sender=dept_of_source(n["source"]), acting=list(n["acting"]),
        objects=list(n["object_ids"]), status=n["status"], ref=FeedRef()) for n in rows]


def _docs(conn, rows: list[repository.DocRow]) -> list[FeedItem]:
    depts = _stage_depts(conn, [l.other_id for d in rows for l in d.links])
    items = []
    for d in rows:
        others = _uniq(l.other_id for l in d.links)
        approved = bool(d.links) and all(l.status == "confirmed" for l in d.links)
        items.append(FeedItem(
            id=d.doc_id, kind="doc", badge="DOC", at=d.effective_from or DEFAULT_AS_OF, title=f"{d.doc_id} · {d.type}",
            reason=d.excerpt[:120], sender=dept_of_source(d.source), acting=_uniq(depts.get(o) for o in others),
            objects=others, status="approved" if approved else "proposed", ref=FeedRef(doc_id=d.doc_id)))
    return items


def _links(conn, rows: list[repository.DocRow]) -> list[FeedItem]:
    doc_at = {d.doc_id: d.effective_from for d in rows}
    doc_source = {d.doc_id: d.source for d in rows}
    items = []
    for r in review.review_queue(conn).pending:
        at = doc_at.get(r.doc_id) if r.doc_id else None
        items.append(FeedItem(
            id=f"LINK-{r.link_id}", kind="link", badge="LINK", at=at or DEFAULT_AS_OF,
            title=f"{r.from_id} → {r.to_id}", reason=f"{r.relation} · score {(r.score or 0):.2f}",
            sender=dept_of_source(doc_source.get(r.doc_id)) if r.doc_id else None, acting=["quality"],
            objects=[r.from_id, r.to_id], status="proposed", ref=FeedRef(link_id=r.link_id, doc_id=r.doc_id)))
    return items


def _claim_at(conn, c: claims.Claim) -> datetime:
    if c.received:
        return datetime.fromisoformat(c.received).replace(tzinfo=PLANT_TZ)
    period = conn.execute("SELECT attributes->>'period' AS p FROM objects WHERE object_id = %s", (c.id,)).fetchone()["p"]
    if period:  # "2026-09" → end of that month
        y, m = map(int, period.split("-"))
        return datetime(y, m, monthrange(y, m)[1], tzinfo=PLANT_TZ)
    return DEFAULT_AS_OF


def _claims(conn) -> list[FeedItem]:
    return [FeedItem(
        id=c.id, kind="claim", badge="CLAIM", at=_claim_at(conn, c),
        title=" · ".join(x for x in (c.id, c.symptom) if x), reason=" · ".join(x for x in (c.customer_name, c.serial) if x),
        sender="quality", acting=["quality", "logistics"], objects=_uniq([c.id, c.serial]),
        status="closed" if c.status == "closed" else "watching", ref=FeedRef(claim_id=c.id))
        for c in claims.list_claims(conn)]


def list_feed(conn) -> list[FeedItem]:
    docs = repository.list_documents(conn)
    items = _notices(conn) + _docs(conn, docs) + _links(conn, docs) + _claims(conn)
    return sorted(items, key=lambda i: (i.at, i.id), reverse=True)
