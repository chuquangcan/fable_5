"""Flow bible (spec 3.3): directed flow edges, validity windows, alias merge, volume collapse."""

from datetime import datetime

from onethread.flow import collapse_map, flow_edges

SPINE = ["SUP-S1", "PO-4410", "RCV-2810", "LOT-B", "HOP-1", "M02", "MH20-0001",
         "BOX-001", "SHP-1112", "SO-7781", "CUS-C3", "CLM-0012"]
AT = datetime.fromisoformat("2026-11-03T14:05:18+07:00")


def test_spine_is_a_directed_path(seeded_conn):
    pairs = {(e.up, e.down) for e in flow_edges(seeded_conn, AT) if not e.shortcut}
    assert all((a, b) in pairs for a, b in zip(SPINE, SPINE[1:]))


def test_lot_a_feed_window(seeded_conn):
    def has(at):
        return any(e.up == "LOT-A" and e.down == "HOP-1" for e in flow_edges(seeded_conn, at))

    assert not has(AT) and has(datetime.fromisoformat("2026-11-03T13:00:00+07:00"))


def test_alias_merged_as_shortcut(seeded_conn):
    e = next(e for e in flow_edges(seeded_conn, AT) if e.up == "SUP-S1" and e.down == "LOT-B")
    assert e.shortcut and "S1-6203-B" not in {x for e in flow_edges(seeded_conn) for x in (e.up, e.down)}


def test_pending_links_are_not_flow(seeded_conn):
    assert not any("D-07" in (e.up, e.down) for e in flow_edges(seeded_conn, include_inactive=True))


def test_collapse_keeps_root(seeded_conn):
    m = collapse_map(seeded_conn, {"MH20-0001", "BOX-001"})
    assert "MH20-0001" not in m and m["MH20-0002"] == "AGG-LOT-B" and m["BOX-042"] == "AGG-LOT-B"
