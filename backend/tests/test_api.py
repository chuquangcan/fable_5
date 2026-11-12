import pytest
from fastapi.testclient import TestClient

from onethread.api import app, get_conn


def test_health():
    assert TestClient(app).get("/api/health").json() == {"status": "ok"}


def test_trace_contains_story_nodes(client):
    ids = {n["id"] for n in client.get("/api/trace/MH20-0001").json()["nodes"]}
    assert {"CLM-0012", "SHP-1112", "SO-7781", "M02", "HOP-1", "LOT-B", "RCV-2810", "PO-4410",
            "S1-6203-B", "SUP-S1", "IQC-5531", "CLM-0009", "D-12", "D-09", "D-07", "D-03"} <= ids
    assert not any(i.startswith("MH20-") and i != "MH20-0001" for i in ids)
    assert not any(i.startswith("BOX-") for i in ids)


def test_trace_edges_only_between_returned_nodes(client):
    body = client.get("/api/trace/MH20-0001").json()
    ids = {n["id"] for n in body["nodes"]}
    assert body["root"] == "MH20-0001"
    assert body["edges"] and all(e["from_id"] in ids and e["to_id"] in ids for e in body["edges"])


def test_compare_by_lot(client):
    rows = {r["lot"]: r for r in client.get("/api/compare/M02?day=2026-11-03").json()}
    assert round(rows["LOT-A"]["cycle_mean_s"]) == 31 and round(rows["LOT-B"]["cycle_mean_s"]) == 42


def test_impact(client):
    b = client.get("/api/impact/LOT-B").json()
    assert (b["parts"], b["boxes"], len(b["shipments"]), b["delivered_shipments"],
            b["delivered_parts"], b["held_parts"]) == (1000, 42, 3, 2, 640, 360)


def test_docs_for_lot(client):
    docs = {d["doc_id"]: d for d in client.get("/api/objects/LOT-B/docs").json()}
    assert docs["D-07"]["status"] == "pending" and docs["D-12"]["page"] == 7


def test_metrics_cpk(client):
    vals = {v["object_id"]: v["value"] for v in client.get("/api/metrics/cpk?objects=LOT-A,LOT-B").json()}
    assert vals == {"LOT-A": 1.45, "LOT-B": 0.92}


@pytest.mark.parametrize("url", ["/api/trace/MH20-9999", "/api/impact/LOT-Z",
                                 "/api/claims/CLM-9999", "/api/objects/NOPE/events"])
def test_unknown_ids_404(client, url):   # Review Focus #2
    r = client.get(url)
    assert r.status_code == 404 and "not found" in r.json()["detail"]


def test_events_window(client):
    r = client.get("/api/objects/M02/events",
                   params={"start": "2026-11-03T12:00:00+07:00", "end": "2026-11-03T16:00:00+07:00"})
    events = r.json()
    assert len(events) > 400
    assert all(e["source"] and e["source_record_id"] for e in events)


def test_events_type_filter(client):
    events = client.get("/api/objects/M02/events",
                        params={"start": "2026-11-03T12:00:00+07:00", "end": "2026-11-03T16:00:00+07:00",
                                "type": "press_cycle"}).json()
    assert len(events) == 400 and {e["type"] for e in events} == {"press_cycle"}


def test_claims_list(client):
    claims = {c["id"]: c for c in client.get("/api/claims").json()}
    assert {k for k, c in claims.items() if c["status"] == "open"} == {"CLM-0012", "CLM-0011"}
    assert claims["CLM-0009"]["status"] == "closed"
    c = client.get("/api/claims/CLM-0012").json()
    assert (c["serial"], c["customer_id"], c["customer_name"], c["received"]) == \
        ("MH20-0001", "CUS-C3", "Customer C3", "2027-02-10")


def test_links_status_filter(client):
    links = client.get("/api/objects/LOT-B/links?status=pending").json()
    assert [(l["other_id"], l["status"]) for l in links] == [("D-07", "pending")]
    assert client.get("/api/objects/LOT-B/links?status=confirmed,inferred").json()


# ---- GET /api/agent/ask (scripted turns, no network) ----
import json as _json  # noqa: E402

from onethread.api import get_turn_factory  # noqa: E402
from tests.conftest import FakeTurn, text_msg, tool_use_msg  # noqa: E402


def _sse_events(resp) -> list[dict]:
    return [_json.loads(line[len("data:"):].strip()) for line in resp.text.splitlines() if line.startswith("data:")]


def test_agent_ask_streams_events(client):
    turn = FakeTurn([tool_use_msg("trace_forward", {"lot_id": "LOT-B"}),
                     text_msg("Impact scope: 1,000 parts [[cite:LOT-B]]")])
    app.dependency_overrides[get_turn_factory] = lambda: (lambda: turn)
    r = client.get("/api/agent/ask", params={"q": "Why?", "claim": "CLM-0012", "mode": "live"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
    evs = _sse_events(r)
    assert [e["type"] for e in evs][0] == "tool_call" and evs[-1]["type"] == "done"
    assert {"type": "cite", "label": "LOT-B", "target_id": "LOT-B"} in evs
    assert "Why?" in turn.requests[0][0]["content"]


def test_agent_ask_unknown_claim_is_404(client):
    app.dependency_overrides[get_turn_factory] = lambda: (lambda: FakeTurn([]))
    r = client.get("/api/agent/ask", params={"q": "x", "claim": "CLM-9999"})
    assert r.status_code == 404 and "not found" in r.json()["detail"]


def test_agent_ask_turns_failures_into_error_event(client):
    def boom():
        raise RuntimeError("no credentials")
    app.dependency_overrides[get_turn_factory] = lambda: boom
    evs = _sse_events(client.get("/api/agent/ask", params={"q": "x", "claim": "CLM-0012", "mode": "live"}))
    assert [e["type"] for e in evs] == ["error"] and "no credentials" in evs[0]["message"]


def test_agent_ask_keeps_db_connection_open_while_streaming(seeded_conn):
    state = {"closed": False, "closed_during_turn": None}

    def conn_dep():
        try:
            yield seeded_conn
        finally:
            state["closed"] = True

    class Turn(FakeTurn):
        async def __call__(self, messages):
            state["closed_during_turn"] = state["closed"]
            async for x in super().__call__(messages):
                yield x

    turn = Turn([text_msg("ok")])
    app.dependency_overrides[get_conn] = conn_dep
    app.dependency_overrides[get_turn_factory] = lambda: (lambda: turn)
    try:
        TestClient(app).get("/api/agent/ask", params={"q": "x", "claim": "CLM-0012"})
    finally:
        app.dependency_overrides.clear()
    assert state["closed_during_turn"] is False


# ---- DEMO_MODE on /api/agent/ask ----

def _fixture_types():
    from onethread.agent.replay import default_fixture_path, load_fixture
    return [e.event.type for e in load_fixture(default_fixture_path()).events]


def test_agent_ask_replay_mode_never_builds_a_turn(client, monkeypatch):
    import onethread.agent.replay as replay
    monkeypatch.setattr(replay, "MAX_DELAY_MS", 0)

    def forbidden():
        raise AssertionError("live must not run in replay mode")

    app.dependency_overrides[get_turn_factory] = lambda: forbidden
    evs = _sse_events(client.get("/api/agent/ask", params={"q": "x", "claim": "CLM-0012", "mode": "replay"}))
    assert [e["type"] for e in evs] == _fixture_types()


def test_agent_ask_auto_falls_back_to_replay_when_claude_fails(client, monkeypatch):
    import onethread.agent.replay as replay
    monkeypatch.setattr(replay, "MAX_DELAY_MS", 0)
    def boom():
        raise RuntimeError("offline")

    app.dependency_overrides[get_turn_factory] = lambda: boom
    evs = _sse_events(client.get("/api/agent/ask", params={"q": "x", "claim": "CLM-0012", "mode": "auto"}))
    assert evs[0]["type"] == "reset" and [e["type"] for e in evs[1:]] == _fixture_types()


def test_agent_ask_rejects_unknown_mode(client):
    app.dependency_overrides[get_turn_factory] = lambda: (lambda: FakeTurn([]))
    assert client.get("/api/agent/ask", params={"q": "x", "claim": "CLM-0012", "mode": "bogus"}).status_code == 422


def test_agent_provider_endpoint_reports_key_based_choice(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "ds")
    monkeypatch.delenv("AGENT_PROVIDER", raising=False)
    body = client.get("/api/agent/provider").json()
    assert body["provider"] == "deepseek" and body["model"] == "deepseek-flash" and body["mode"] in {"live", "replay", "auto"}
    monkeypatch.setenv("DEEPSEEK_API_KEY", "")
    assert client.get("/api/agent/provider").json()["provider"] is None
