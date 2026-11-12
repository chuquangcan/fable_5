"""Line 2 topology and the notices table (alerts and 4M changes) seeded from story.yaml."""

from datetime import datetime, timedelta, timezone

PLANT = timezone(timedelta(hours=7))


def t(*args) -> datetime:
    return datetime(*args, tzinfo=PLANT)


def test_notices_seeded(seeded_conn):
    rows = {r["notice_id"]: r for r in seeded_conn.execute("select * from notices")}
    assert set(rows) == {"4M-0001", "4M-0002", "AL-0001"}
    al = rows["AL-0001"]
    assert (al["kind"], al["severity"], al["source"], al["status"]) == ("alert", "P1", "PLC2", "watching")
    assert al["at"] == t(2026, 11, 3, 14, 0) and set(al["acting"]) == {"quality", "maintenance"}
    assert rows["4M-0001"]["at"] == t(2026, 10, 28, 15, 0) and "IQC-5531" in rows["4M-0001"]["object_ids"]
    assert rows["4M-0002"]["at"] == t(2026, 11, 3, 13, 52) and rows["4M-0002"]["source"] == "WMS"


def test_line2_topology(seeded_conn):
    def has(f, to, rel):
        return seeded_conn.execute(
            "select 1 from links where from_id=%s and to_id=%s and relation=%s", (f, to, rel)).fetchone()

    for f, to, rel in [("M01", "LINE-2", "part_of"), ("M03", "LINE-2", "part_of"), ("HOP-1", "LINE-1", "part_of"),
                       ("HOP-2", "LINE-2", "part_of"), ("HOP-2", "M01", "fed_into"), ("HOP-2", "M03", "fed_into"),
                       ("LOT-C", "HOP-2", "fed_into")]:
        assert has(f, to, rel), (f, to, rel)


def test_m01_mean_cycle(seeded_conn):
    r = seeded_conn.execute(
        "select avg((payload->>'cycle_s')::float) c from events where type='press_cycle' and 'M01'=any(object_ids)"
    ).fetchone()
    assert 32.5 <= r["c"] <= 33.5


def test_clm0012_fault_reach_excludes_line2(seeded_conn):
    from onethread.queries.fault import claim_fault_trace

    ft = claim_fault_trace(seeded_conn, "CLM-0012")
    ids = {m.id for m in ft.red + ft.orange}
    assert not ids & {"M01", "M03", "HOP-2", "LINE-2", "LOT-C"}
