import pytest

RED = {"MH20-0001", "M02", "HOP-1", "LOT-B", "RCV-2810", "PO-4410", "SUP-S1"}
ORANGE = {"BOX-001", "AGG-LOT-B", "SHP-1112", "SHP-1115", "SHP-1120", "SO-7781", "SO-7790",
          "CUS-C3", "CUS-C5", "PO-4380", "RCV-1410", "LOT-A"}


def ids(ms):
    return {m["id"] for m in ms}


def test_claim_fault_matches_spec(client):
    f = client.get("/api/claims/CLM-0012/fault-trace").json()
    assert ids(f["red"]) == RED and ids(f["orange"]) == ORANGE
    assert next(m for m in f["red"] if m["id"] == "HOP-1")["reason"].startswith("thượng nguồn của M02")


def test_time_window_changes_red(client):
    f = client.get("/api/fault-trace", params={"origin": "M02", "at": "2026-11-03T13:00:00+07:00"}).json()
    assert {"LOT-A", "RCV-1410", "PO-4380", "SUP-S1"} <= ids(f["red"]) and "LOT-B" not in ids(f["red"])
    assert "LOT-B" in ids(f["orange"])


@pytest.mark.parametrize("origin", ["IQC-5531", "D-07", "CLM-0009"])
def test_non_flow_origin(client, origin):
    f = client.get("/api/fault-trace", params={"origin": origin}).json()
    assert ids(f["red"]) == {origin} and f["orange"] == []


def test_unknown_origin_404(client):
    assert client.get("/api/fault-trace", params={"origin": "NOPE"}).status_code == 404
