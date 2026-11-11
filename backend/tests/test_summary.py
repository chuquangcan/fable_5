import pytest


def p(s, label):
    return next(x for x in s["params"] if x["label"] == label)


def test_machine_summary(client):
    s = client.get("/api/objects/M02/summary").json()
    assert round(p(s, "Cycle TB · LOT-A")["value"]) == 31 and round(p(s, "Cycle TB · LOT-B")["value"]) == 42
    assert p(s, "Mục tiêu cycle")["value"] == 30
    assert p(s, "Lực ép TB · LOT-B")["value"] == pytest.approx(13.1, abs=0.1)
    assert p(s, "Bảo trì gần nhất")["source_record_id"] == "PM-0241"
    assert "NV-118" in p(s, "Vận hành")["value"] and p(s, "Nhiệt độ line")["value"] == "26.2–26.9"


def test_lot_summary(client):
    s = client.get("/api/objects/LOT-B/summary").json()
    assert p(s, "Số lượng")["value"] == 5000 and p(s, "Cpk IQC")["value"].startswith("0.92")
    assert p(s, "Ngày nhập")["value"] == "2026-10-28 09:10" and p(s, "Nhà cung cấp")["value"] == "SUP-S1"


def test_supplier_docs(client):
    s = client.get("/api/objects/SUP-S1/summary").json()
    assert {"D-09", "D-03"} <= {d["doc_id"] for d in s["docs"]}


def test_aggregate_summary(client):                       # Review Focus #1
    s = client.get("/api/objects/AGG-LOT-B/summary").json()
    assert s["type"] == "aggregate" and p(s, "Số part")["value"] == 1000 and p(s, "Số thùng")["value"] == 42


def test_empty_node_summary(client):                      # Review Focus #5
    s = client.get("/api/objects/M01/summary").json()
    assert s["params"] == [] and s["docs"] == []


def test_every_flow_node_has_summary(client):
    f = client.get("/api/flow/CLM-0012").json()
    for n in f["spine"] + f["branches"]:
        r = client.get(f"/api/objects/{n['id']}/summary")
        assert r.status_code == 200 and all(x["source"] for x in r.json()["params"])


@pytest.mark.parametrize("id", ["NOPE-1", "AGG-NOPE", "AGG-M02"])
def test_summary_404(client, id):
    assert client.get(f"/api/objects/{id}/summary").status_code == 404


def test_stage_is_raw_code(client):
    assert client.get("/api/objects/M02/summary").json()["stage"] == "san_xuat"
    assert client.get("/api/objects/IQC-5531/summary").json()["stage"] == "dinh_kem"
    assert client.get("/api/objects/AGG-LOT-B/summary").json()["stage"] == "san_xuat"


def test_event_record_summary(client):                    # agent cites a side-event record ID
    r = client.get("/api/objects/PM-0241/summary")
    assert r.status_code == 200
    s = r.json()
    assert s["type"] == "event" and s["id"] == "PM-0241" and s["name"].startswith("maintenance")
    assert p(s, "Thời điểm")["source"] == "CMMS" and p(s, "Thời điểm")["source_record_id"] == "PM-0241"
    assert p(s, "Đối tượng")["value"] == "M02" and p(s, "result")["value"] == "normal"
    shift = client.get("/api/objects/HR-SHIFT-1103/summary").json()
    assert p(shift, "changed")["value"] == "False" and p(shift, "operator")["value"] == "NV-118"


@pytest.mark.parametrize("id,n", [("PLC2", 1682), ("CMMS", 1), ("ENV-L1", 5)])
def test_event_source_summary(client, id, n):
    r = client.get(f"/api/objects/{id}/summary")
    assert r.status_code == 200
    s = r.json()
    assert s["type"] == "source" and s["name"] == id and p(s, "Số sự kiện")["value"] == n
    assert s["counts"]["events"] == n


def test_object_wins_over_event_record(client):          # RCV-2810 is a receipt object and a WMS record
    assert client.get("/api/objects/RCV-2810/summary").json()["type"] == "receipt"
