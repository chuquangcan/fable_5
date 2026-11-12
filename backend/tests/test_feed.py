"""GET /api/feed: notices, documents, links waiting for review and claims in one list, newest first."""


def test_feed_newest_first(client):
    items = client.get("/api/feed").json()
    ats = [i["at"] for i in items]
    assert ats == sorted(ats, reverse=True) and len({i["id"] for i in items}) == len(items)


def test_feed_notice_items(client):
    by = {i["id"]: i for i in client.get("/api/feed").json()}
    al = by["AL-0001"]
    assert (al["kind"], al["badge"], al["sender"], al["status"]) == ("alert", "P1", "production", "watching")
    assert set(al["acting"]) == {"quality", "maintenance"} and "M02" in al["objects"]
    assert (by["4M-0001"]["kind"], by["4M-0001"]["badge"], by["4M-0001"]["sender"]) == ("4m", "4M", "quality")


def test_feed_docs_links_claims(client):
    by = {i["id"]: i for i in client.get("/api/feed").json()}
    assert (by["D-12"]["badge"], by["D-12"]["sender"]) == ("DOC", "design")
    assert by["D-07"]["status"] == "proposed" and by["D-07"]["sender"] == "meeting"
    link = next(i for i in by.values() if i["kind"] == "link" and i["objects"] == ["D-07", "LOT-B"])
    assert link["badge"] == "LINK" and isinstance(link["ref"]["link_id"], int) and link["ref"]["doc_id"] == "D-07"
    assert by["CLM-0012"]["status"] == "watching" and "MH20-0001" in by["CLM-0012"]["objects"]
    assert by["CLM-0012"]["ref"]["claim_id"] == "CLM-0012"
    assert by["CLM-0009"]["status"] == "closed"


def test_feed_includes_uploads(client, seeded_conn):
    from onethread import attach

    res = client.post("/api/documents/samples/CoA_S1-6203-B.pdf").json()
    try:
        assert any(i["id"] == res["doc_id"] and i["kind"] == "doc" for i in client.get("/api/feed").json())
    finally:
        attach.reset_uploads(seeded_conn)
