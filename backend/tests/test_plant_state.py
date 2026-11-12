"""GET /api/plant/state and /api/plant/overview: the plant as of one demo time."""
import pytest

AT = "2026-11-03T14:05:00+07:00"


def test_state_at_1405(client):
    s = client.get("/api/plant/state", params={"at": AT}).json()["nodes"]
    assert s["M02"]["state"] == "warning" and s["M02"]["value"] == "42 s / 30 s"
    assert s["M01"]["state"] == "running" and s["LOT-B"]["state"] == "watch4m"
    assert s["LOT-B"]["value"] == "4,981 pcs"  # 5000 − 19 cycles 13:52 … 14:04:36
    assert s["HOP-1"]["value"] == "LOT-B" and s["SHP-1112"]["value"] == "delivered · 2026-11-12"
    assert s["LINE-1"]["sub"] == "MH-20"


def test_state_before_lot_b(client):
    s = client.get("/api/plant/state", params={"at": "2026-11-03T13:00:00+07:00"}).json()
    assert s["nodes"]["M02"]["state"] == "running" and s["nodes"]["HOP-1"]["value"] == "LOT-A"
    pairs = {(e["from_id"], e["to_id"]) for e in s["edges"]}
    assert ("LOT-A", "HOP-1") in pairs and ("LOT-B", "HOP-1") not in pairs
    assert ("HOP-2", "M01") in pairs and ("M02", "LINE-1") in pairs


def test_state_default_as_of(client):
    assert client.get("/api/plant/state").json()["at"].startswith("2026-11-03T14:05:00")


def test_overview_rows_and_kpis(client):
    o = client.get("/api/plant/overview", params={"at": AT}).json()
    assert [r["id"] for r in o["rows"]] == ["LINE-1", "M02", "LINE-2", "M01", "M03"]
    m02 = next(r for r in o["rows"] if r["id"] == "M02")
    assert m02["lot"] == "LOT-B" and len(m02["trend"]) == 30 and m02["target_s"] == 30
    assert (o["kpis"]["open_alerts"], o["kpis"]["watch_4m"]) == (1, 2) and o["kpis"]["output"] > 0
    assert o["kpis"]["pending_links"] >= 1
    assert all(s["risk"] == "high" for s in o["shipments"]) and "IQC-5531" in o["shipments"][0]["reason"]
    plc2 = next(r for r in o["sources"] if r["source"] == "PLC2")
    assert plc2["delay_s"] == 38 and plc2["dept"] == "production"


@pytest.mark.parametrize("at", ["2026-10-01T08:00:00+07:00", "2027-02-10T00:00:00+07:00"])
def test_out_of_range_as_of(client, at):  # Review Focus #5
    s = client.get("/api/plant/state", params={"at": at}).json()["nodes"]
    assert s["M01"]["state"] == "stopped"
    o = client.get("/api/plant/overview", params={"at": at}).json()
    assert o["kpis"]["output"] == 0 and all(r["output"] == 0 for r in o["rows"])
    if at.startswith("2026-10"):
        assert s["M01"]["value"] == "— / 32 s" and all(r["trend"] == [] for r in o["rows"])
