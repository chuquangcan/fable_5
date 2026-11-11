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


def test_only_confirmed_or_inferred_flow_relations_are_edges(seeded_conn):
    """Status filter must bite on flow relations; temporary rows are removed afterwards."""
    ids = {}
    try:
        for status, frm, to in [("pending", "LOT-A", "M01"), ("suggested", "LOT-A", "M03"),
                                ("inferred", "HOP-1", "M03")]:
            ids[status] = seeded_conn.execute(
                "INSERT INTO links (from_id, to_id, relation, tier, status, score, rule_version, evidence)"
                " VALUES (%s, %s, 'fed_into', 3, %s, 0.8, 'T3-rule', '{}') RETURNING link_id",
                (frm, to, status),
            ).fetchone()["link_id"]
        edges = {e.link_id: e for e in flow_edges(seeded_conn, include_inactive=True)}
        assert ids["pending"] not in edges and ids["suggested"] not in edges
        inferred = edges[ids["inferred"]]
        assert (inferred.up, inferred.down, inferred.status) == ("HOP-1", "M03", "inferred")
    finally:
        if ids:
            seeded_conn.execute("DELETE FROM links WHERE link_id = ANY(%s)", (list(ids.values()),))


def test_include_inactive_flags_lot_a_and_uses_lot_is_shortcut(seeded_conn):
    edges = flow_edges(seeded_conn, AT, include_inactive=True)
    lot_a = next(e for e in edges if e.up == "LOT-A" and e.down == "HOP-1")
    assert lot_a.active is False
    uses = next(e for e in edges if e.relation == "uses_lot" and e.down == "MH20-0001")
    assert (uses.up, uses.shortcut) == ("LOT-B", True)


def test_collapse_keeps_root(seeded_conn):
    m = collapse_map(seeded_conn, {"MH20-0001", "BOX-001"})
    assert "MH20-0001" not in m and m["MH20-0002"] == "AGG-LOT-B" and m["BOX-042"] == "AGG-LOT-B"
