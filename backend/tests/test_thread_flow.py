"""DEMO-17: `GET /api/flow/{id}` — the straight material-flow thread (spec 3.3)."""

import pytest

from tests.test_flow import SPINE


def test_flow_spine_from_claim(client):
    f = client.get("/api/flow/CLM-0012").json()
    assert [n["id"] for n in f["spine"]] == SPINE
    assert f["at"].startswith("2026-11-03T07:05:18")         # UTC
    assert client.get("/api/flow/MH20-0001").json()["spine"] == f["spine"]


def test_flow_branches(client):
    f = client.get("/api/flow/CLM-0012").json()
    assert {n["id"] for n in f["branches"]} == {"PO-4380", "RCV-1410", "LOT-A", "AGG-LOT-B",
                                               "SHP-1115", "SHP-1120", "SO-7790", "CUS-C5"}
    agg = next(n for n in f["branches"] if n["id"] == "AGG-LOT-B")
    assert agg["members"] == {"parts": 999, "boxes": 41}
    lot_a = next(e for e in f["edges"] if e["up"] == "LOT-A" and e["down"] == "HOP-1")
    assert lot_a["active"] is False


def test_flow_attachments(client):
    a = client.get("/api/flow/CLM-0012").json()["attachments"]
    assert {"IQC-5531", "D-07", "D-12"} <= {x["id"] for x in a["LOT-B"]}
    assert {"PM-0241", "HR-SHIFT-1103", "ENV-L1", "PLC2"} <= {x["id"] for x in a["M02"]}
    assert {"CLM-0009", "D-09", "D-03"} <= {x["id"] for x in a["SUP-S1"]}


def test_flow_other_serial_ends_at_c5(client):           # Review Focus #2
    f = client.get("/api/flow/MH20-0500").json()
    ids = [n["id"] for n in f["spine"]]
    assert ids[-3:] == ["SHP-1115", "SO-7790", "CUS-C5"] and not any(i.startswith("CLM") for i in ids)
    agg = next(n for n in f["branches"] if n["type"] == "aggregate")
    assert agg["members"]["parts"] == 999


@pytest.mark.parametrize("url", ["/api/flow/MH20-9999", "/api/flow/LOT-B"])
def test_flow_404(client, url):
    assert client.get(url).status_code == 404
