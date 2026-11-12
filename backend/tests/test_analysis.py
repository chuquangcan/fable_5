"""Generic machine cycle window and lot comparison (behind the deep evidence tabs)."""
import dataclasses

import pytest

from onethread import config


@pytest.fixture(autouse=True)
def _isolated(client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "settings", dataclasses.replace(config.settings, uploads_dir=str(tmp_path)))
    client.post("/api/demo/reset")
    yield
    client.post("/api/demo/reset")


def test_machine_window_is_derived_from_the_lot_change(client):
    w = client.get("/api/machines/M02/cycle-window").json()
    assert (w["day"], w["start"], w["end"]) == ("2026-11-03", "2026-11-03T12:00:00+07:00", "2026-11-03T16:00:00+07:00")
    assert (w["change"]["lot"], w["change"]["hopper"], w["change"]["source_record_id"]) == ("LOT-B", "HOP-1", "ISS-1103")
    assert (w["cycle_source"], w["offset_s"], w["target_s"], w["line"]) == ("PLC2", 38.0, 30.0, "LINE-1")


def test_machine_without_cycles_and_non_machine(client):
    w = client.get("/api/machines/M01/cycle-window").json()
    assert w["day"] is None and w["change"] is None
    assert client.get("/api/machines/LOT-B/cycle-window").status_code == 404


def test_lot_compare_rows_spec_and_similar_claim(client):
    c = client.get("/api/lots/LOT-B/compare").json()
    assert (c["part"], c["part_name"]) == ("BRG-6203", "Bearing 6203")
    rows = {r["lot"]: r for r in c["rows"]}
    assert (rows["LOT-B"]["cpk"], rows["LOT-B"]["spec_doc"], rows["LOT-B"]["spec_page"]) == (0.92, "D-12", 7)
    assert (rows["LOT-A"]["cpk"], rows["LOT-A"]["receipt"], rows["LOT-A"]["supplier"]) == (1.45, "RCV-1410", "SUP-S1")
    assert [(s["id"], s["via"], s["docs"]) for s in c["similar"]] == [("CLM-0009", "SUP-S1", ["D-09"])]
    # an IQC or the lot aggregate resolve to the lot
    assert client.get("/api/lots/IQC-5531/compare").json()["lot"] == "LOT-B"
    assert client.get("/api/lots/AGG-LOT-B/compare").json()["lot"] == "LOT-B"
    assert client.get("/api/lots/M02/compare").status_code == 404


def test_rejecting_the_supplier_link_drops_the_similar_claim(client):
    q = client.get("/api/review-queue").json()["pending"]
    link = next(i for i in q if (i["from_id"], i["to_id"]) == ("CLM-0009", "SUP-S1"))
    client.post(f"/api/links/{link['link_id']}/review", json={"decision": "reject"})
    assert client.get("/api/lots/LOT-B/compare").json()["similar"] == []
