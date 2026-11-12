"""Link review (approve / reject + reset), document store, raw tables, plant tree, search."""
import dataclasses

import pytest

from onethread import config


@pytest.fixture(autouse=True)
def _isolated(client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "settings", dataclasses.replace(config.settings, uploads_dir=str(tmp_path)))
    client.post("/api/demo/reset")
    yield
    client.post("/api/demo/reset")


def _queue(client):
    return client.get("/api/review-queue").json()


def _link(client, from_id, to_id):
    return next(i for i in _queue(client)["pending"] if i["from_id"] == from_id and i["to_id"] == to_id)


def _doc_status(client, obj, doc):
    return next((d["status"] for d in client.get(f"/api/objects/{obj}/docs").json() if d["doc_id"] == doc), None)


# ---------------------------------------------------------------- review

def test_queue_lists_the_three_unreviewed_seed_links(client):
    q = _queue(client)
    assert {(i["from_id"], i["to_id"], i["status"]) for i in q["pending"]} == {
        ("D-07", "LOT-B", "pending"), ("D-03", "CLM-0009", "suggested"), ("CLM-0009", "SUP-S1", "inferred")}
    assert q["decided"] == []
    assert _link(client, "D-07", "LOT-B")["doc_id"] == "D-07"


def test_approve_confirms_and_reset_restores(client):
    link = _link(client, "D-07", "LOT-B")
    r = client.post(f"/api/links/{link['link_id']}/review", json={"decision": "approve", "note": "reviewed the report"})
    assert r.status_code == 200 and r.json()["from_status"] == "pending"
    assert _doc_status(client, "LOT-B", "D-07") == "confirmed"
    assert all(i["link_id"] != link["link_id"] for i in _queue(client)["pending"])
    detail = client.get("/api/documents/D-07").json()
    assert detail["status"] == "confirmed" and detail["history"][0]["note"] == "reviewed the report"

    assert client.post("/api/demo/reset").json()["reviews"] == 1
    assert _doc_status(client, "LOT-B", "D-07") == "pending"
    assert _queue(client)["decided"] == []


def test_reject_hides_link_everywhere_and_reset_restores_same_id(client):
    link = _link(client, "D-07", "LOT-B")
    assert client.post(f"/api/links/{link['link_id']}/review", json={"decision": "reject"}).status_code == 200
    assert _doc_status(client, "LOT-B", "D-07") is None
    flow = client.get("/api/flow/CLM-0012").json()
    assert all(a["id"] != "D-07" for a in flow["attachments"].get("LOT-B", []))
    assert client.get("/api/documents/D-07").json()["status"] == "unlinked"

    client.post("/api/demo/reset")
    assert _link(client, "D-07", "LOT-B")["link_id"] == link["link_id"]
    assert _doc_status(client, "LOT-B", "D-07") == "pending"


def test_review_errors(client):
    confirmed = client.get("/api/db/tables/links", params={"q": "T1-exact", "limit": 1}).json()["rows"][0]
    assert client.post(f"/api/links/{confirmed['link_id']}/review", json={"decision": "approve"}).status_code == 409
    assert client.post("/api/links/999999/review", json={"decision": "approve"}).status_code == 404
    link = _link(client, "D-03", "CLM-0009")
    assert client.post(f"/api/links/{link['link_id']}/review", json={"decision": "maybe"}).status_code == 422


def test_rejected_upload_link_comes_back_then_goes_with_the_upload(client):
    up = client.post("/api/documents/samples/CoA_S1-6203-B.pdf").json()
    link = _link(client, up["doc_id"], "LOT-B")
    client.post(f"/api/links/{link['link_id']}/review", json={"decision": "reject"})
    assert client.post("/api/demo/reset").json() == {"removed": 1, "reviews": 1}
    assert client.get("/api/db/tables/links", params={"q": up["doc_id"]}).json()["total"] == 0


# ---------------------------------------------------------------- documents

def test_document_list_filters_and_upload_first(client):
    up = client.post("/api/documents/samples/CoA_S1-6203-B.pdf").json()
    rows = client.get("/api/documents").json()
    assert rows[0]["doc_id"] == up["doc_id"] and rows[0]["uploaded"] and rows[0]["has_file"]
    assert {r["doc_id"] for r in rows[1:]} == {"D-03", "D-07", "D-09", "D-12"}
    assert [r["doc_id"] for r in client.get("/api/documents", params={"status": "pending"}).json()] == ["D-07"]
    assert [r["doc_id"] for r in client.get("/api/documents", params={"type": "drawing"}).json()] == ["D-12"]
    assert {r["doc_id"] for r in client.get("/api/documents", params={"q": "8D"}).json()} == {"D-09"}


def test_document_detail_and_file(client):
    d = client.get("/api/documents/D-12").json()
    assert d["pages"] == [7] and d["chunks"][0]["text"].startswith("MH-20 bearing drawing") and not d["has_file"]
    assert client.get("/api/documents/D-12/file").status_code == 404  # seeded docs keep their bytes in PLM
    assert client.get("/api/documents/D-99").status_code == 404

    up = client.post("/api/documents/samples/Email_CustomerC5_delivery_confirmation.txt").json()
    f = client.get(f"/api/documents/{up['doc_id']}/file")
    assert f.status_code == 200 and f.headers["content-type"].startswith("text/plain")
    assert f.headers["x-content-type-options"] == "nosniff" and "sandbox" in f.headers["content-security-policy"]
    assert f.headers["content-disposition"].startswith("inline")


# ---------------------------------------------------------------- tables, plant, search

def test_tables_whitelist_and_paging(client):
    tables = {t["name"]: t for t in client.get("/api/db/tables").json()}
    assert set(tables) == {"objects", "aliases", "events", "documents", "links", "time_mappings", "link_reviews"}
    assert "embedding" not in tables["documents"]["columns"]
    page = client.get("/api/db/tables/objects", params={"limit": 5, "offset": 5}).json()
    assert len(page["rows"]) == 5 and page["total"] == tables["objects"]["rows"]
    assert client.get("/api/db/tables/pg_user").status_code == 404
    assert client.get("/api/db/tables/objects", params={"q": "Machine 02"}).json()["total"] == 1


def test_plant_tree(client):
    areas = {a["id"]: a for a in client.get("/api/plant").json()}
    assert list(areas) == ["kho_nl", "san_xuat", "chat_luong", "kho_tp"]
    prod = {g["type"]: g for g in areas["san_xuat"]["groups"]}
    m02 = next(i for i in prod["machine"]["items"] if i["id"] == "M02")
    assert m02["sub"] == "Line 1" and m02["events"] > 1000
    assert areas["san_xuat"]["volume"] == "1,000 serial" and areas["kho_tp"]["volume"] == "42 boxes"
    lot_b = next(i for g in areas["kho_nl"]["groups"] for i in g["items"] if i["id"] == "LOT-B")
    assert lot_b["to_review"] == 1 and lot_b["docs"] >= 1


def test_search(client):
    hits = client.get("/api/search", params={"q": "M02"}).json()
    assert hits[0]["id"] == "M02"
    assert any(h["id"] == "D-12" and h["kind"] == "document" for h in client.get("/api/search", params={"q": "Cpk"}).json())
    assert client.get("/api/search", params={"q": " "}).json() == []
