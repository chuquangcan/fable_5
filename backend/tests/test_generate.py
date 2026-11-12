from onethread.seed import seed
from onethread.seed.generate import generate_volume


def test_story_loads_core_ids(story):
    ids = {o["id"] for o in story["objects"]}
    assert {"CLM-0012", "M02", "LOT-B", "IQC-5531", "PO-4410", "SUP-S1"} <= ids
    assert story["volume"]["n_parts"] == 1000
    assert sum(s["parts"] for s in story["volume"]["shipments"]) == 1000
    assert sum(s["boxes"] for s in story["volume"]["shipments"]) == 42


def test_schema_applies_twice(conn):
    from onethread.db import apply_schema

    apply_schema(conn)
    apply_schema(conn)
    assert conn.execute("select count(*) as n from objects").fetchone()["n"] == 0


def test_volume_counts(story):
    v = generate_volume(story)
    serials = [o for o in v.objects if o["type"] == "serial"]
    boxes = [o for o in v.objects if o["type"] == "box"]
    assert len(serials) == 1000 and len(boxes) == 42


def test_serial_0001_pressed_at_1405(story):
    v = generate_volume(story)
    ev = next(e for e in v.events if "MH20-0001" in e["object_ids"])
    assert ev["event_time"].isoformat() == "2026-11-03T14:05:18+07:00"


def test_generation_is_deterministic(story):
    assert generate_volume(story).events == generate_volume(story).events


def test_seed_idempotent(conn, story_path):
    seed(conn, story_path)
    seed(conn, story_path)
    assert conn.execute("select count(*) n from objects where type='serial'").fetchone()["n"] == 1000


def test_extra_machines_have_cycles_but_no_serials(story):
    v = generate_volume(story)
    extra = [e for e in v.events if e["type"] == "press_cycle" and e["object_ids"][0] in ("M01", "M03")]
    assert {e["object_ids"][0] for e in extra} == {"M01", "M03"}
    assert all(len(e["object_ids"]) == 1 for e in extra)
    assert {e["source"] for e in extra} == {"PLC1", "PLC3"}
    assert len([o for o in v.objects if o["type"] == "serial"]) == 1000
