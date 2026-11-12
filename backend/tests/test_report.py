import pytest
from fastapi.testclient import TestClient

from onethread.api import app, get_conn
from onethread.queries.common import NotFound
from onethread.report import build_report_draft


def _text(segments) -> str:
    return "".join(s.text if s.kind == "text" else f"[{s.label}]" for s in segments)


def test_draft_numbers_come_from_the_data(seeded_conn):
    d = build_report_draft(seeded_conn, "CLM-0012")
    assert d.id == "RPT-CLM-0012"
    assert "CLM-0012" in d.title and "MH-20" in d.title
    assert (d.impact.parts, d.impact.boxes, d.impact.delivered_parts, d.impact.held_parts) == (1000, 42, 640, 360)
    cause = _text(d.cause)
    assert "0.92" in cause and "1.33" in cause and "31 → 42 s" in cause
    assert [c.id for c in d.chain] == ["CLM-0012", "SHP-1112", "MH20-0001", "M02", "LOT-B", "PO-4410"]
    assert d.chain[3].label == "Machine 02 · 11-03 14:05"
    assert d.chain[4].label == "LOT-B ≡ S1-6203-B"


def test_cites_resolve_to_known_records(seeded_conn):  # Review Focus #3
    d = build_report_draft(seeded_conn, "CLM-0012")
    cites = [s for s in [*d.summary, *d.cause] if s.kind == "cite"]
    assert len(cites) >= 3
    for c in cites:
        assert c.target_id is not None
        known = seeded_conn.execute(
            "SELECT 1 FROM objects WHERE object_id=%(i)s UNION ALL SELECT 1 FROM documents WHERE doc_id=%(i)s",
            {"i": c.target_id},
        ).fetchone()
        assert known, c.target_id


def test_actions(seeded_conn):
    d = build_report_draft(seeded_conn, "CLM-0012")
    assert d.actions == [
        "Quarantine 360 parts of SHP-1120 in the warehouse",
        "Contact Customer C5 about SHP-1115 (240 parts, no claim yet)",
        "Ask Supplier S1 to file an 8D report for LOT-B",
        "Reapply the IQC sampling level n=20 used for CLM-0009",
    ]


@pytest.mark.parametrize("claim", ["CLM-9999", "CLM-0011", "CLM-0009"])
def test_unavailable_report_raises_not_found(seeded_conn, claim):
    with pytest.raises(NotFound):
        build_report_draft(seeded_conn, claim)


def test_draft_route(seeded_conn):
    app.dependency_overrides[get_conn] = lambda: seeded_conn
    try:
        c = TestClient(app)
        body = c.get("/api/reports/CLM-0012/draft").json()
        assert body["id"] == "RPT-CLM-0012" and body["impact"]["delivered_parts"] == 640
        assert {"kind": "cite", "label": "IQC-5531", "target_id": "IQC-5531"} in body["cause"]
        r = c.get("/api/reports/CLM-9999/draft")  # Review Focus #2
        assert r.status_code == 404 and "not found" in r.json()["detail"]
    finally:
        app.dependency_overrides.clear()
