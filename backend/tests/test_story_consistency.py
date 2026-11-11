"""Guards the story bible (spec 3.1): every headline number is asserted straight from SQL."""

from datetime import date, datetime, timedelta, timezone

PLANT = timezone(timedelta(hours=7))


def t(*args) -> datetime:
    return datetime(*args, tzinfo=PLANT)


def _press_means(conn, start: datetime, end: datetime) -> dict:
    return conn.execute(
        """select avg((payload->>'cycle_s')::float) as cycle, avg((payload->>'peak_force_kn')::float) as force
           from events
           where type = 'press_cycle' and 'M02' = any(object_ids) and event_time >= %s and event_time < %s""",
        (start, end),
    ).fetchone()


def _attrs(conn, object_id: str) -> dict:
    return conn.execute("select attributes from objects where object_id = %s", (object_id,)).fetchone()["attributes"]


def _link(conn, from_id: str, to_id: str) -> dict:
    return conn.execute("select * from links where from_id = %s and to_id = %s", (from_id, to_id)).fetchone()


def test_cycle_time_jumps_at_1352(seeded_conn):
    before = _press_means(seeded_conn, t(2026, 11, 3, 12), t(2026, 11, 3, 13, 52))["cycle"]
    after = _press_means(seeded_conn, t(2026, 11, 3, 13, 52), t(2026, 11, 3, 16))["cycle"]
    assert 30.7 <= before <= 31.3
    assert 41.7 <= after <= 42.3


def test_peak_force_up_6_percent(seeded_conn):
    force_a = _press_means(seeded_conn, t(2026, 11, 3, 12), t(2026, 11, 3, 13, 52))["force"]
    force_b = _press_means(seeded_conn, t(2026, 11, 3, 13, 52), t(2026, 11, 3, 16))["force"]
    assert round((force_b / force_a - 1) * 100) == 6


def test_iqc_cpk(seeded_conn):
    b, a = _attrs(seeded_conn, "IQC-5531"), _attrs(seeded_conn, "IQC-5507")
    assert b["cpk"] == 0.92 and b["lot"] == "LOT-B" and b["verdict"] == "Chấp nhận có điều kiện"
    assert a["cpk"] == 1.45
    assert a["spec_min"] == 1.33 and b["spec_min"] == 1.33


def test_receipt_date(seeded_conn):
    ev = seeded_conn.execute(
        "select event_time, object_ids from events where type = 'goods_receipt' and source_record_id = 'RCV-2810'"
    ).fetchone()
    assert ev["event_time"] == t(2026, 10, 28, 9, 10)
    assert "PO-4410" in ev["object_ids"]


def test_lot_b_loaded_1352(seeded_conn):
    ev = seeded_conn.execute("select event_time from events where type = 'lot_loaded'").fetchone()
    assert ev["event_time"] == t(2026, 11, 3, 13, 52)
    offset = seeded_conn.execute("select offset_s from time_mappings where source = 'PLC2'").fetchone()
    assert offset["offset_s"] == 38


def test_serial_0001_pressed_1405_on_m02(seeded_conn):
    ev = seeded_conn.execute(
        "select event_time, object_ids from events where type = 'press_cycle' and 'MH20-0001' = any(object_ids)"
    ).fetchone()
    assert "M02" in ev["object_ids"]
    assert ev["event_time"] == t(2026, 11, 3, 14, 5, 18)


def test_impact_numbers(seeded_conn):
    one = lambda sql: seeded_conn.execute(sql).fetchone()["n"]
    assert one("select count(distinct from_id) n from links where relation='uses_lot' and to_id='LOT-B'") == 1000
    assert one("select count(distinct to_id) n from links where relation='packed_in'") == 42
    shipped = "from links l join objects s on s.object_id = l.to_id where l.relation='shipped_in' and l.from_id like 'MH20-%%'"
    assert one(f"select count(distinct l.to_id) n {shipped}") == 3
    assert one(f"select count(*) n {shipped} and s.attributes->>'status' = 'delivered'") == 640
    assert one(f"select count(*) n {shipped} and s.attributes->>'status' = 'in_warehouse'") == 360


def test_claim_links_serial(seeded_conn):
    link = _link(seeded_conn, "CLM-0012", "MH20-0001")
    assert link["relation"] == "about" and link["tier"] == 1 and link["status"] == "confirmed"
    claim = _attrs(seeded_conn, "CLM-0012")
    assert claim["received"] == "2027-02-10" and claim["customer"] == "CUS-C3"


def test_review_states(seeded_conn):
    pending = _link(seeded_conn, "D-07", "LOT-B")
    assert (pending["status"], pending["score"], pending["tier"]) == ("pending", 0.78, 4)
    suggested = _link(seeded_conn, "D-03", "CLM-0009")
    assert (suggested["status"], suggested["tier"]) == ("suggested", 5)


def test_exclusions_normal(seeded_conn):
    pm = seeded_conn.execute("select event_time, payload from events where source_record_id = 'PM-0241'").fetchone()
    assert pm["event_time"].date() == date(2026, 10, 20) and pm["payload"]["result"] == "normal"
    shift = seeded_conn.execute("select payload from events where type = 'shift'").fetchone()["payload"]
    assert shift["operator"] == "NV-118" and shift["changed"] is False
    temps = [r["temp"] for r in seeded_conn.execute(
        "select (payload->>'temp_c')::float as temp from events where type = 'env_temp'")]
    assert temps and all(26 <= x <= 27 for x in temps)


def test_delivery_three_months_before_claim(seeded_conn):
    delivered = date.fromisoformat(_attrs(seeded_conn, "SHP-1112")["date"])
    received = date.fromisoformat(_attrs(seeded_conn, "CLM-0012")["received"])
    assert delivered == date(2026, 11, 12) and received == date(2027, 2, 10)
    assert (received - delivered).days >= 88
