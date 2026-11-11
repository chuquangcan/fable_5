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
