import pytest
from fastapi.testclient import TestClient

from onethread.api import app, get_conn


@pytest.fixture
def client(seeded_conn):
    app.dependency_overrides[get_conn] = lambda: seeded_conn
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health():
    assert TestClient(app).get("/api/health").json() == {"status": "ok"}


def test_trace_contains_story_nodes(client):
    ids = {n["id"] for n in client.get("/api/trace/MH20-0001").json()["nodes"]}
    assert {"CLM-0012", "SHP-1112", "SO-7781", "M02", "HOP-1", "LOT-B", "RCV-2810", "PO-4410",
            "S1-6203-B", "SUP-S1", "IQC-5531", "CLM-0009", "D-12", "D-09", "D-07", "D-03"} <= ids
    assert not any(i.startswith("MH20-") and i != "MH20-0001" for i in ids)
    assert not any(i.startswith("BOX-") for i in ids)


def test_trace_edges_only_between_returned_nodes(client):
    body = client.get("/api/trace/MH20-0001").json()
    ids = {n["id"] for n in body["nodes"]}
    assert body["root"] == "MH20-0001"
    assert body["edges"] and all(e["from_id"] in ids and e["to_id"] in ids for e in body["edges"])


def test_compare_by_lot(client):
    rows = {r["lot"]: r for r in client.get("/api/compare/M02?day=2026-11-03").json()}
    assert round(rows["LOT-A"]["cycle_mean_s"]) == 31 and round(rows["LOT-B"]["cycle_mean_s"]) == 42


def test_impact(client):
    b = client.get("/api/impact/LOT-B").json()
    assert (b["parts"], b["boxes"], len(b["shipments"]), b["delivered_shipments"],
            b["delivered_parts"], b["held_parts"]) == (1000, 42, 3, 2, 640, 360)


def test_docs_for_lot(client):
    docs = {d["doc_id"]: d for d in client.get("/api/objects/LOT-B/docs").json()}
    assert docs["D-07"]["status"] == "pending" and docs["D-12"]["page"] == 7


def test_metrics_cpk(client):
    vals = {v["object_id"]: v["value"] for v in client.get("/api/metrics/cpk?objects=LOT-A,LOT-B").json()}
    assert vals == {"LOT-A": 1.45, "LOT-B": 0.92}


@pytest.mark.parametrize("url", ["/api/trace/MH20-9999", "/api/impact/LOT-Z",
                                 "/api/claims/CLM-9999", "/api/objects/NOPE/events"])
def test_unknown_ids_404(client, url):   # Review Focus #2
    r = client.get(url)
    assert r.status_code == 404 and "not found" in r.json()["detail"]


def test_events_window(client):
    r = client.get("/api/objects/M02/events",
                   params={"start": "2026-11-03T12:00:00+07:00", "end": "2026-11-03T16:00:00+07:00"})
    events = r.json()
    assert len(events) > 400
    assert all(e["source"] and e["source_record_id"] for e in events)


def test_events_type_filter(client):
    events = client.get("/api/objects/M02/events",
                        params={"start": "2026-11-03T12:00:00+07:00", "end": "2026-11-03T16:00:00+07:00",
                                "type": "press_cycle"}).json()
    assert len(events) == 400 and {e["type"] for e in events} == {"press_cycle"}


def test_claims_list(client):
    claims = {c["id"]: c for c in client.get("/api/claims").json()}
    assert {k for k, c in claims.items() if c["status"] == "open"} == {"CLM-0012", "CLM-0011"}
    assert claims["CLM-0009"]["status"] == "closed"
    c = client.get("/api/claims/CLM-0012").json()
    assert (c["serial"], c["customer_id"], c["customer_name"], c["received"]) == \
        ("MH20-0001", "CUS-C3", "Customer C3", "2027-02-10")


def test_links_status_filter(client):
    links = client.get("/api/objects/LOT-B/links?status=pending").json()
    assert [(l["other_id"], l["status"]) for l in links] == [("D-07", "pending")]
    assert client.get("/api/objects/LOT-B/links?status=confirmed,inferred").json()
