"""Demo document attach: hard-coded classification (catalog -> known-ID match -> manual hint) + demo reset.

This is the demo's only write path. Uploaded docs are `D-U<nn>` rows in `documents` plus one `mentions`
link each; the read queries (docs, flow, summary) pick them up through the ordinary link graph.
"""
import re
from pathlib import Path
from typing import Literal

import yaml
from fastapi import HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from onethread import config

REPO = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPO / "data" / "attachments.yaml"
SAMPLES_DIR = REPO / "data" / "attachments"

ALLOWED_EXT = {"pdf", "txt", "png", "jpg", "docx"}
MAX_BYTES = 10 * 2**20
MIN_CODE_LEN = 3  # M01..M03 are real object ids
RULE_VERSION = "demo-attach-v0"
EFFECTIVE_FROM = config.DEMO_NOW
MAX_SAFE_NAME = 120
MAX_TEXT = 5000

Method = Literal["code", "rule", "llm", "manual"]


class AttachLink(BaseModel):
    to_id: str
    tier: int
    status: str
    score: float | None = None


class AttachResult(BaseModel):
    doc_id: str
    type: str
    method: Method
    links: list[AttachLink]
    reason: str
    duplicate: bool = False


def load_catalog() -> list[dict]:
    return yaml.safe_load(CATALOG_PATH.read_text(encoding="utf-8"))


def list_samples() -> list[str]:
    return [e["file"] for e in load_catalog()]


def sample_content(name: str) -> bytes:
    """Bytes of a catalog sample; only names listed in the catalog are readable (no path input)."""
    if name not in list_samples():
        raise HTTPException(404, f"sample {name} not found")
    return (SAMPLES_DIR / name).read_bytes()


def safe_filename(name: str) -> str:
    base = Path(name.replace("\\", "/")).name
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return safe[-MAX_SAFE_NAME:]


def _upload_path(doc_id: str, safe_name: str) -> Path:
    return Path(config.settings.uploads_dir) / f"{doc_id}_{safe_name}"


def _existing(conn, safe_name: str) -> AttachResult | None:
    row = conn.execute(
        "SELECT doc_id, type FROM documents WHERE doc_id LIKE 'D-U%%'"
        " AND file_uri = 'uploads/' || doc_id || '_' || %s ORDER BY doc_id LIMIT 1",
        (safe_name,),
    ).fetchone()
    if row is None:
        return None
    links = conn.execute(
        "SELECT to_id, tier, status, score, evidence FROM links WHERE from_id = %s ORDER BY link_id",
        (row["doc_id"],),
    ).fetchall()
    ev = links[0]["evidence"] if links else {}
    return AttachResult(
        doc_id=row["doc_id"], type=row["type"], method=ev.get("method", "manual"),
        links=[AttachLink(to_id=l["to_id"], tier=l["tier"], status=l["status"], score=l["score"]) for l in links],
        reason=ev.get("reason", ""), duplicate=True,
    )


def _match_known_ids(conn, haystack: str) -> list[str]:
    ids = sorted(
        (r["object_id"] for r in conn.execute("SELECT object_id FROM objects")
         if len(r["object_id"]) >= MIN_CODE_LEN),
        key=lambda i: (-len(i), i),
    )
    if not ids:
        return []
    pattern = re.compile(r"(?<![A-Za-z0-9])(" + "|".join(re.escape(i) for i in ids) + r")(?![A-Za-z0-9])")
    found: list[str] = []
    for m in pattern.finditer(haystack):
        if m.group(1) not in found:
            found.append(m.group(1))
    return found


def _classify(conn, safe_name: str, content: bytes, ext: str, target_hint: str | None) -> dict:
    entry = next((e for e in load_catalog() if e["file"] == safe_name), None)
    if entry:
        return {"type": entry["type"], "method": entry["method"], "targets": [entry["target"]],
                "tier": entry["tier"], "status": entry["status"], "score": entry["score"],
                "reason": entry["reason"], "text": entry["text"]}
    body = content.decode("utf-8", errors="ignore")[:MAX_TEXT] if ext == "txt" else ""
    text = body or f"Uploaded document: {safe_name}"
    found = _match_known_ids(conn, f"{safe_name}\n{body}")
    if found:
        return {"type": "upload", "method": "code", "targets": found, "tier": 4, "status": "inferred",
                "score": 0.90, "reason": "Matched code " + ", ".join(found) + " in file name/content", "text": text}
    if not target_hint:
        raise HTTPException(422, "no known object code found; target_hint is required")
    if conn.execute("SELECT 1 FROM objects WHERE object_id = %s", (target_hint,)).fetchone() is None:
        raise HTTPException(422, f"target_hint {target_hint} is not a known object")
    return {"type": "upload", "method": "manual", "targets": [target_hint], "tier": 4, "status": "pending",
            "score": 0.70, "reason": f"User chose target {target_hint}", "text": text}


def attach_document(conn, filename: str, content: bytes, target_hint: str | None) -> AttachResult:
    safe_name = safe_filename(filename)
    ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"unsupported file type .{ext}; allowed: {', '.join(sorted(ALLOWED_EXT))}")
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "file larger than 10 MB")
    if (dup := _existing(conn, safe_name)) is not None:
        return dup
    c = _classify(conn, safe_name, content, ext, target_hint)

    n = conn.execute("SELECT count(DISTINCT doc_id) AS n FROM documents WHERE doc_id LIKE 'D-U%%'").fetchone()["n"] + 1
    doc_id = f"D-U{n:02d}"
    path = _upload_path(doc_id, safe_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    try:
        with conn.transaction():
            conn.execute(
                "INSERT INTO documents (doc_id, chunk_id, file_uri, type, source, page, text, extracted_codes,"
                " effective_from) VALUES (%s, %s, %s, %s, 'UPLOAD', 1, %s, %s, %s)",
                (doc_id, f"{doc_id}-c1", f"uploads/{doc_id}_{safe_name}", c["type"], c["text"],
                 c["targets"], EFFECTIVE_FROM),
            )
            evidence = Jsonb({"method": c["method"], "reason": c["reason"], "file": safe_name})
            for t in c["targets"]:
                conn.execute(
                    "INSERT INTO links (from_id, to_id, relation, tier, status, score, rule_version, evidence)"
                    " VALUES (%s, %s, 'mentions', %s, %s, %s, %s, %s)",
                    (doc_id, t, c["tier"], c["status"], c["score"], RULE_VERSION, evidence),
                )
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return AttachResult(
        doc_id=doc_id, type=c["type"], method=c["method"], reason=c["reason"], duplicate=False,
        links=[AttachLink(to_id=t, tier=c["tier"], status=c["status"], score=c["score"]) for t in c["targets"]],
    )


def reset_uploads(conn) -> int:
    """Remove every uploaded (D-U*) doc, its links and its stored file; returns the number of docs removed."""
    uploads = Path(config.settings.uploads_dir)
    with conn.transaction():
        rows = conn.execute("SELECT DISTINCT doc_id, file_uri FROM documents WHERE doc_id LIKE 'D-U%%'").fetchall()
        conn.execute("DELETE FROM links WHERE from_id LIKE 'D-U%%' OR to_id LIKE 'D-U%%'")
        conn.execute("DELETE FROM documents WHERE doc_id LIKE 'D-U%%'")
    if uploads.is_dir():
        for r in rows:  # basename only: never follow a stored path outside the uploads dir
            (uploads / Path(r["file_uri"]).name).unlink(missing_ok=True)
    return len({r["doc_id"] for r in rows})
