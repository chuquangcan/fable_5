"""Read-only repository views: the document store, the raw DB tables and a global search."""
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from onethread import config
from onethread.queries.common import NotFound
from onethread.review import ReviewItem, ReviewRecord, history, links_of

EXCERPT = 160
# Best-first: a document's overall status is the best status among its links.
STATUS_RANK = {"confirmed": 0, "inferred": 1, "pending": 2, "suggested": 3}
UNLINKED = "unlinked"


# ---------------------------------------------------------------- documents

class DocLinkRef(BaseModel):
    link_id: int
    other_id: str
    relation: str
    tier: int
    status: str
    score: float | None = None


class DocRow(BaseModel):
    doc_id: str
    type: str
    source: str | None = None
    pages: list[int]
    file_uri: str | None = None
    has_file: bool
    uploaded: bool
    effective_from: datetime | None = None
    excerpt: str
    codes: list[str]
    status: str  # best link status, or "unlinked"
    links: list[DocLinkRef]


class DocChunk(BaseModel):
    chunk_id: str
    page: int | None = None
    text: str
    extracted_codes: list[str]


class DocDetail(DocRow):
    chunks: list[DocChunk]
    review_links: list[ReviewItem]
    history: list[ReviewRecord]


def _stored_file(file_uri: str | None) -> Path | None:
    """Uploaded files live in the uploads dir; seeded docs point at source systems (no bytes in the demo)."""
    if not file_uri or not file_uri.startswith("uploads/"):
        return None
    uploads = Path(config.settings.uploads_dir).resolve()
    path = (uploads / Path(file_uri).name).resolve()  # basename only: never leave the uploads dir
    return path if path.parent == uploads and path.is_file() else None


def _doc_rows(conn, doc_ids: list[str] | None) -> list[DocRow]:
    chunks = conn.execute(
        """SELECT doc_id, chunk_id, page, type, source, file_uri, text, extracted_codes, effective_from
           FROM documents WHERE %(d)s::text[] IS NULL OR doc_id = ANY(%(d)s) ORDER BY doc_id, chunk_id""",
        {"d": doc_ids}).fetchall()
    by_doc: dict[str, list[dict]] = {}
    for c in chunks:
        by_doc.setdefault(c["doc_id"], []).append(c)
    links = conn.execute(
        """SELECT link_id, from_id, to_id, relation, tier, status, score FROM links
           WHERE from_id = ANY(%(d)s) OR to_id = ANY(%(d)s) ORDER BY tier, link_id""",
        {"d": list(by_doc)}).fetchall()
    refs: dict[str, list[DocLinkRef]] = {}
    for l in links:
        for doc, other in ((l["from_id"], l["to_id"]), (l["to_id"], l["from_id"])):
            if doc in by_doc:
                refs.setdefault(doc, []).append(DocLinkRef(
                    link_id=l["link_id"], other_id=other, relation=l["relation"], tier=l["tier"],
                    status=l["status"], score=l["score"]))
    out = []
    for doc_id, cs in by_doc.items():
        first = cs[0]
        doc_links = refs.get(doc_id, [])
        statuses = sorted((r.status for r in doc_links), key=lambda s: STATUS_RANK.get(s, 9))
        text = " ".join(c["text"] or "" for c in cs)
        out.append(DocRow(
            doc_id=doc_id, type=first["type"], source=first["source"],
            pages=sorted({c["page"] for c in cs if c["page"] is not None}),
            file_uri=first["file_uri"], has_file=_stored_file(first["file_uri"]) is not None,
            uploaded=doc_id.startswith("D-U"), effective_from=first["effective_from"],
            excerpt=text[:EXCERPT] + ("…" if len(text) > EXCERPT else ""),
            codes=sorted({x for c in cs for x in (c["extracted_codes"] or [])}),
            status=statuses[0] if statuses else UNLINKED, links=doc_links,
        ))
    return out


def list_documents(conn, q: str | None = None, type: str | None = None, status: str | None = None,
                   source: str | None = None) -> list[DocRow]:
    rows = _doc_rows(conn, None)
    if q:
        needle = q.casefold()
        rows = [r for r in rows if needle in " ".join(
            [r.doc_id, r.type, r.source or "", r.excerpt, *r.codes, *(l.other_id for l in r.links)]).casefold()]
    if type:
        rows = [r for r in rows if r.type == type]
    if source:
        rows = [r for r in rows if r.source == source]
    if status:
        rows = [r for r in rows if (status == UNLINKED and not r.links) or any(l.status == status for l in r.links)]
    # newest uploads first, then the seeded docs by id
    return sorted(rows, key=lambda r: (not r.uploaded, -int(r.doc_id[3:]) if r.uploaded else 0, r.doc_id))


def get_document(conn, doc_id: str) -> DocDetail:
    rows = _doc_rows(conn, [doc_id])
    if not rows:
        raise NotFound("document", doc_id)
    chunks = conn.execute(
        "SELECT chunk_id, page, text, extracted_codes FROM documents WHERE doc_id = %s ORDER BY chunk_id",
        (doc_id,)).fetchall()
    return DocDetail(**rows[0].model_dump(), chunks=[DocChunk(**c) for c in chunks],
                     review_links=links_of(conn, [doc_id]), history=history(conn, [doc_id]))


# Served inline only for types a browser renders without running page scripts; everything else downloads.
INLINE_TYPES = {"application/pdf", "text/plain", "image/png", "image/jpeg"}


def document_file(conn, doc_id: str) -> tuple[Path, str, bool]:
    """(path, media type, inline?) of an uploaded document's stored bytes."""
    row = conn.execute("SELECT file_uri FROM documents WHERE doc_id = %s ORDER BY chunk_id LIMIT 1",
                       (doc_id,)).fetchone()
    if row is None:
        raise NotFound("document", doc_id)
    path = _stored_file(row["file_uri"])
    if path is None:
        raise NotFound("stored file of document", doc_id)
    media = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return path, media, media in INLINE_TYPES


# ---------------------------------------------------------------- raw tables

# table -> (order by, columns never returned)
TABLES: dict[str, tuple[str, set[str]]] = {
    "objects": ("object_id", set()),
    "aliases": ("system, local_name", set()),
    "events": ("event_time, event_id", set()),
    "documents": ("doc_id, chunk_id", {"embedding"}),
    "links": ("link_id", set()),
    "time_mappings": ("source, valid_from", set()),
    "link_reviews": ("review_id", set()),
}
MAX_LIMIT = 200


class TableInfo(BaseModel):
    name: str
    rows: int
    columns: list[str]


class TablePage(BaseModel):
    name: str
    columns: list[str]
    total: int
    offset: int
    limit: int
    rows: list[dict[str, Any]]


def _columns(conn, name: str) -> list[str]:
    hidden = TABLES[name][1]
    return [r["column_name"] for r in conn.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema()"
        " AND table_name = %s ORDER BY ordinal_position", (name,)) if r["column_name"] not in hidden]


def list_tables(conn) -> list[TableInfo]:
    # table names come from the TABLES whitelist, never from input
    return [TableInfo(name=t, rows=conn.execute(f"SELECT count(*) AS n FROM {t}").fetchone()["n"],
                      columns=_columns(conn, t)) for t in TABLES]


def table_rows(conn, name: str, q: str | None = None, limit: int = 50, offset: int = 0) -> TablePage:
    if name not in TABLES:
        raise NotFound("table", name)
    order, _ = TABLES[name]
    cols = _columns(conn, name)
    select = ", ".join(cols)
    where, params = ("WHERE t::text ILIKE %(q)s", {"q": f"%{q}%"}) if q else ("", {})
    limit = max(1, min(limit, MAX_LIMIT))
    total = conn.execute(f"SELECT count(*) AS n FROM {name} t {where}", params).fetchone()["n"]
    rows = conn.execute(
        f"SELECT {select} FROM {name} t {where} ORDER BY {order} LIMIT %(l)s OFFSET %(o)s",
        {**params, "l": limit, "o": max(0, offset)}).fetchall()
    return TablePage(name=name, columns=cols, total=total, offset=max(0, offset), limit=limit, rows=rows)


# ---------------------------------------------------------------- search

class SearchHit(BaseModel):
    id: str
    kind: str  # "object" | "document"
    type: str
    name: str


def search(conn, q: str, limit: int = 20) -> list[SearchHit]:
    q = q.strip()
    if not q:
        return []
    like = f"%{q}%"
    objs = conn.execute(
        """SELECT object_id, type, name FROM objects
           WHERE object_id ILIKE %(l)s OR name ILIKE %(l)s
           ORDER BY (object_id ILIKE %(p)s) DESC, (type IN ('serial', 'box')), object_id LIMIT %(n)s""",
        {"l": like, "p": f"{q}%", "n": limit}).fetchall()
    docs = conn.execute(
        """SELECT DISTINCT ON (doc_id) doc_id, type FROM documents
           WHERE doc_id ILIKE %(l)s OR type ILIKE %(l)s OR text ILIKE %(l)s OR array_to_string(extracted_codes, ' ') ILIKE %(l)s
           ORDER BY doc_id, chunk_id LIMIT %(n)s""",
        {"l": like, "n": limit}).fetchall()
    # objects (prefix matches first, from the SQL order) before documents, so a serial fragment finds the serial
    hits = [SearchHit(id=o["object_id"], kind="object", type=o["type"], name=o["name"]) for o in objs]
    hits += [SearchHit(id=d["doc_id"], kind="document", type="document", name=d["type"]) for d in docs]
    return hits[:limit]
