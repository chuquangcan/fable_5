import dataclasses

import pytest

from onethread import config


@pytest.fixture(autouse=True)
def _isolated_uploads(client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "settings", dataclasses.replace(config.settings, uploads_dir=str(tmp_path)))
    client.post("/api/demo/reset")
    yield
    client.post("/api/demo/reset")


def test_samples_attach_per_catalog(client):
    assert len(client.get("/api/documents/samples").json()) == 3
    r = client.post("/api/documents/samples/CoA_S1-6203-B.pdf").json()
    assert (r["method"], r["links"][0]["to_id"], r["links"][0]["status"]) == ("code", "LOT-B", "inferred")
    assert r["doc_id"] in {d["doc_id"] for d in client.get("/api/objects/LOT-B/docs").json()}


def test_unknown_txt_matches_code(client):
    r = client.post("/api/documents", files={"file": ("ghi_chu.txt", b"Kiem tra lai PO-4410")}).json()
    assert r["method"] == "code" and r["links"][0]["to_id"] == "PO-4410"


def test_manual_needs_hint(client):
    assert client.post("/api/documents", files={"file": ("x.txt", b"khong co ma")}).status_code == 422
    r = client.post("/api/documents", data={"target_hint": "HOP-1"}, files={"file": ("x.txt", b"khong co ma")}).json()
    assert r["method"] == "manual" and r["links"][0]["to_id"] == "HOP-1"


def test_unsafe_and_duplicate_names(client, tmp_path):     # Review Focus #4
    a = client.post("/api/documents", files={"file": ("../../etc/Biên bản M02.txt", b"M02")}).json()
    b = client.post("/api/documents", files={"file": ("../../etc/Biên bản M02.txt", b"M02")}).json()
    assert b["duplicate"] and b["doc_id"] == a["doc_id"]
    assert all(p.parent == tmp_path for p in tmp_path.iterdir())


def test_limits(client):
    assert client.post("/api/documents", files={"file": ("a.exe", b"x")}).status_code == 415
    assert client.post("/api/documents", files={"file": ("a.txt", b"x" * (10 * 2**20 + 1))}).status_code == 413


def test_reset_removes_uploads(client):
    client.post("/api/documents/samples/CoA_S1-6203-B.pdf")
    assert client.post("/api/demo/reset").json()["removed"] == 1
    assert not any(d["doc_id"].startswith("D-U") for d in client.get("/api/objects/LOT-B/docs").json())
