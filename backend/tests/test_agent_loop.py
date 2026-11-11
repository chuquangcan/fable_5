import json

import pytest

from onethread.agent.events import TextEv
from onethread.agent.loop import ClaudeTurn, load_known_ids, run_agent
from onethread.agent.prompt import SYSTEM_PROMPT
from onethread.agent.tools import TOOLS, dispatch_tool

from tests.conftest import FakeTurn, refusal_msg, text_msg, tool_use_msg


async def _run(conn, turn, **kw):
    return [e async for e in run_agent("q", "CLM-0012", conn=conn, turn=turn, **kw)]


async def test_tool_then_answer(seeded_conn):
    turn = FakeTurn([tool_use_msg("trace_serial", {"serial": "MH20-0001"}),
                     text_msg("Nguyên nhân khả dĩ: LOT-B [[cite:IQC-5531]]\n\nKhoanh vùng: 1,000 part")])
    evs = [e async for e in run_agent("q", "CLM-0012", conn=seeded_conn, turn=turn)]
    assert evs[0].type == "tool_call" and evs[0].name == "trace_serial"
    assert any(e.type == "cite" and e.target_id == "IQC-5531" for e in evs)
    assert [e.action for e in evs if e.type == "action"] == ["open_impact", "open_report"]
    assert evs[-1].type == "done"
    assert turn.requests[1][-1]["content"][0]["type"] == "tool_result"   # one user msg with results


async def test_first_request_carries_question_and_claim(seeded_conn):
    turn = FakeTurn([text_msg("ok")])
    await _run(seeded_conn, turn)
    first = turn.requests[0][0]
    assert first["role"] == "user" and "q" in first["content"] and "Context: claim CLM-0012" in first["content"]


async def test_bad_tool_input_returns_error_result(seeded_conn):
    turn = FakeTurn([tool_use_msg("trace_serial", {"serial": "MH20-9999"}), text_msg("ok")])
    _ = [e async for e in run_agent("q", "CLM-0012", conn=seeded_conn, turn=turn)]
    assert turn.requests[1][-1]["content"][0]["is_error"] is True


async def test_refusal_yields_error(seeded_conn):
    turn = FakeTurn([refusal_msg()])
    evs = [e async for e in run_agent("q", "CLM-0012", conn=seeded_conn, turn=turn)]
    assert evs[-1].type == "error"


async def test_parallel_tool_calls_share_one_user_message(seeded_conn):
    first = tool_use_msg("trace_forward", {"lot_id": "LOT-B"}, "t1")
    first.content.append(tool_use_msg("trace_serial", {"serial": "MH20-0001"}, "t2").content[0])
    turn = FakeTurn([first, text_msg("xong")])
    evs = await _run(seeded_conn, turn)
    assert [e.name for e in evs if e.type == "tool_call"] == ["trace_forward", "trace_serial"]
    results = turn.requests[1][-1]["content"]
    assert [r["tool_use_id"] for r in results] == ["t1", "t2"]
    assert turn.requests[1][-2]["role"] == "assistant"          # raw tool_use blocks echoed back


async def test_no_khoanh_vung_means_no_open_impact(seeded_conn):
    evs = await _run(seeded_conn, FakeTurn([text_msg("Nguyên nhân khả dĩ: chưa rõ")]))
    assert [e.action for e in evs if e.type == "action"] == ["open_report"]


async def test_too_many_tool_calls_stops(seeded_conn):
    turn = FakeTurn([tool_use_msg("trace_forward", {"lot_id": "LOT-B"}, f"t{i}") for i in range(5)])
    evs = await _run(seeded_conn, turn, max_tool_calls=2)
    assert sum(e.type == "tool_call" for e in evs) == 2
    assert any(e.type == "text" and "quá số bước" in e.text for e in evs)
    assert evs[-1].type == "done"


async def test_max_tokens_flushes_partial_marker_and_finishes(seeded_conn):
    evs = await _run(seeded_conn, FakeTurn([text_msg("dở [[cit", "max_tokens")]))
    assert "".join(e.text for e in evs if e.type == "text") == "dở [[cit"
    assert evs[-1].type == "done" and not any(e.type == "action" for e in evs)


def test_known_ids_cover_objects_docs_and_sources(seeded_conn):
    ids = load_known_ids(seeded_conn)
    assert {"IQC-5531", "LOT-B", "D-12", "PLC2", "PM-0241", "ENV-L1"} <= ids


# ---- tools ----

def test_tool_schemas_are_strict_and_eager():
    assert [t["name"] for t in TOOLS] == ["trace_serial", "get_events", "get_links", "get_docs",
                                         "metrics", "run_python", "trace_forward"]
    for t in TOOLS:
        assert t["input_schema"]["additionalProperties"] is False and t["input_schema"]["required"] is not None
        assert t["eager_input_streaming"] is True and t["description"]


def test_dispatch_validation_and_unknown_tool_are_errors(seeded_conn):
    assert "error" in dispatch_tool(seeded_conn, "trace_serial", {})
    assert "error" in dispatch_tool(seeded_conn, "trace_serial", {"serial": "MH20-0001", "x": 1})
    assert "error" in dispatch_tool(seeded_conn, "delete_everything", {})
    assert "error" in dispatch_tool(seeded_conn, "get_events", {"object_id": "M02", "start": "not a date"})


def test_dispatch_results_are_json_and_capped(seeded_conn):
    r = dispatch_tool(seeded_conn, "get_events", {"object_id": "M02", "start": "2026-11-03T12:00:00+07:00",
                                                  "end": "2026-11-03T16:00:00+07:00", "type": "press_cycle"})
    json.dumps(r)
    assert len(r["events"]) == 200 and r["summary"]["count"] == 400
    assert r["summary"]["by_lot"]["LOT-A"]["n"] == 217 and r["summary"]["by_lot"]["LOT-B"]["n"] == 183
    assert round(r["summary"]["by_lot"]["LOT-B"]["mean_cycle_s"]) == 42


def test_dispatch_other_tools(seeded_conn):
    assert dispatch_tool(seeded_conn, "trace_forward", {"lot_id": "LOT-B"})["delivered_parts"] == 640
    cpk = dispatch_tool(seeded_conn, "metrics", {"kpi": "cpk", "object_ids": ["LOT-A", "LOT-B"]})
    assert {v["object_id"]: v["value"] for v in cpk["values"]} == {"LOT-A": 1.45, "LOT-B": 0.92}
    cmp_ = dispatch_tool(seeded_conn, "run_python", {"analysis": "compare_by_lot", "machine_id": "M02", "day": "2026-11-03"})
    assert {r["lot"] for r in cmp_["rows"]} == {"LOT-A", "LOT-B"}
    docs = dispatch_tool(seeded_conn, "get_docs", {"object_id": "LOT-B"})
    assert {d["doc_id"] for d in docs["docs"]} >= {"D-07", "D-12"}
    links = dispatch_tool(seeded_conn, "get_links", {"object_id": "LOT-B", "statuses": ["pending"]})
    assert [l["other_id"] for l in links["links"]] == ["D-07"]
    tr = dispatch_tool(seeded_conn, "trace_serial", {"serial": "MH20-0001"})
    assert "LOT-B" in {n["id"] for n in tr["nodes"]}


# ---- ClaudeTurn request shape (no network: mock transport) ----

async def test_claude_turn_request_shape_and_stream():
    import anthropic
    import httpx2 as httpx

    seen = {}
    sse = "\n".join([
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Xin "}}\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"chào"}}\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":2}}\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n',
    ])

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        seen["beta"] = request.headers.get("anthropic-beta", "")
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=sse.encode())

    client = anthropic.AsyncAnthropic(api_key="test", http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    out = [x async for x in ClaudeTurn(client, "claude-opus-5-5", "low")([{"role": "user", "content": "hi"}])]
    assert [v for k, v in out if k == "text"] == ["Xin ", "chào"]
    assert out[-1][0] == "message" and out[-1][1].stop_reason == "end_turn"

    body = seen["body"]
    assert body["model"] == "claude-opus-5-5" and body["max_tokens"] == 16000 and body["stream"] is True
    assert body["output_config"] == {"effort": "low"} and body["system"] == SYSTEM_PROMPT
    assert body["tools"] == TOOLS and "thinking" not in body and "tool_choice" not in body
    assert "server-side-fallback-2026-07-01" in seen["beta"]
    assert body["fallbacks"] == "default"
