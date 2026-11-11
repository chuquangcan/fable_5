import json
from types import SimpleNamespace

import httpx
import pytest

from onethread.agent.deepseek import DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, DeepSeekTurn, to_openai_messages, to_openai_tools
from onethread.agent.loop import ClaudeTurn, run_agent
from onethread.agent.providers import NoProviderError, active_provider, make_turn, resolve_provider
from onethread.agent.prompt import SYSTEM_PROMPT
from onethread.agent.tools import TOOLS


# ---- which key to use ----

@pytest.mark.parametrize("env,expected", [
    ({"DEEPSEEK_API_KEY": "ds"}, "deepseek"),
    ({"ANTHROPIC_API_KEY": "an"}, "anthropic"),
    ({"ANTHROPIC_API_KEY": "an", "DEEPSEEK_API_KEY": "ds"}, "anthropic"),     # both set → Claude
    ({"ANTHROPIC_API_KEY": "", "DEEPSEEK_API_KEY": "ds"}, "deepseek"),        # empty .env line = not set
    ({"ANTHROPIC_API_KEY": "  ", "DEEPSEEK_API_KEY": ""}, None),
    ({}, None),
    ({"AGENT_PROVIDER": "deepseek", "ANTHROPIC_API_KEY": "an", "DEEPSEEK_API_KEY": "ds"}, "deepseek"),
    ({"AGENT_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": "an", "DEEPSEEK_API_KEY": "ds"}, "anthropic"),
    ({"AGENT_PROVIDER": "auto", "DEEPSEEK_API_KEY": "ds"}, "deepseek"),
])
def test_resolve_provider(env, expected):
    assert resolve_provider(env) == expected


def test_forced_provider_without_its_key_is_an_error():
    with pytest.raises(NoProviderError, match="ANTHROPIC_API_KEY"):
        resolve_provider({"AGENT_PROVIDER": "anthropic", "DEEPSEEK_API_KEY": "ds"})
    with pytest.raises(NoProviderError, match="DEEPSEEK_API_KEY"):
        resolve_provider({"AGENT_PROVIDER": "deepseek"})
    with pytest.raises(NoProviderError, match="AGENT_PROVIDER"):
        resolve_provider({"AGENT_PROVIDER": "gpt", "DEEPSEEK_API_KEY": "ds"})


def test_make_turn_picks_class_by_key():
    assert isinstance(make_turn({"DEEPSEEK_API_KEY": "ds"}), DeepSeekTurn)
    assert isinstance(make_turn({"ANTHROPIC_API_KEY": "an"}), ClaudeTurn)
    with pytest.raises(NoProviderError, match="ANTHROPIC_API_KEY.*DEEPSEEK_API_KEY"):
        make_turn({})


def test_deepseek_is_flash_only():
    assert DEEPSEEK_MODEL == "deepseek-flash" and DEEPSEEK_BASE_URL == "https://api.deepseek.com"
    assert "flash" in make_turn({"DEEPSEEK_API_KEY": "ds"}).model
    # a stray DEEPSEEK_MODEL env must not switch to a bigger model
    assert make_turn({"DEEPSEEK_API_KEY": "ds", "DEEPSEEK_MODEL": "deepseek-v4-pro"}).model == "deepseek-flash"


def test_active_provider_reports_model():
    assert active_provider({"DEEPSEEK_API_KEY": "ds"}) == {"provider": "deepseek", "model": "deepseek-flash"}
    assert active_provider({"ANTHROPIC_API_KEY": "an"})["provider"] == "anthropic"
    assert active_provider({}) == {"provider": None, "model": None}


# ---- Anthropic-style history → OpenAI chat format ----

def test_history_conversion():
    tool_block = SimpleNamespace(type="tool_use", id="t1", name="trace_forward", input={"lot_id": "LOT-B"})
    text_block = SimpleNamespace(type="text", text="Để kiểm tra")
    msgs = [
        {"role": "user", "content": "câu hỏi\n\nContext: claim CLM-0012"},
        {"role": "assistant", "content": [text_block, tool_block]},
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t1", "content": '{"parts": 1000}'},
                                     {"type": "tool_result", "tool_use_id": "t2", "content": '{"error": "x"}', "is_error": True}]},
    ]
    out = to_openai_messages(msgs)
    assert out[0]["role"] == "system" and out[0]["content"].startswith(SYSTEM_PROMPT)
    assert out[1] == {"role": "user", "content": "câu hỏi\n\nContext: claim CLM-0012"}
    assert out[2]["role"] == "assistant" and out[2]["content"] == "Để kiểm tra"
    assert out[2]["tool_calls"] == [{"id": "t1", "type": "function",
                                     "function": {"name": "trace_forward", "arguments": '{"lot_id": "LOT-B"}'}}]
    assert out[3] == {"role": "tool", "tool_call_id": "t1", "content": '{"parts": 1000}'}
    assert out[4]["role"] == "tool" and out[4]["tool_call_id"] == "t2"


def test_assistant_without_text_has_null_content():
    blk = SimpleNamespace(type="tool_use", id="t1", name="get_links", input={"object_id": "LOT-B"})
    out = to_openai_messages([{"role": "assistant", "content": [blk]}])
    assert out[1]["content"] is None


def test_tools_conversion_drops_anthropic_only_keys():
    tools = to_openai_tools(TOOLS)
    assert [t["function"]["name"] for t in tools] == [t["name"] for t in TOOLS]
    assert all(t["type"] == "function" and "eager_input_streaming" not in t["function"] for t in tools)
    assert tools[0]["function"]["parameters"] == TOOLS[0]["input_schema"]


# ---- DeepSeekTurn against a mock transport (no network) ----

def sse(*chunks) -> bytes:
    body = "".join(f"data: {json.dumps(c)}\n\n" for c in chunks) + "data: [DONE]\n\n"
    return body.encode()


def chunk(delta=None, finish=None):
    return {"id": "c", "object": "chat.completion.chunk", "created": 1, "model": "deepseek-flash",
            "choices": [{"index": 0, "delta": delta or {}, "finish_reason": finish}]}


def mock_turn(responses: list[bytes], seen: list):
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append({"url": str(request.url), "auth": request.headers.get("authorization"),
                     "body": json.loads(request.content)})
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=responses.pop(0))

    return DeepSeekTurn(api_key="ds-key",
                        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))


TEXT_STREAM = sse(chunk({"role": "assistant", "content": "Nguyên nhân "}), chunk({"content": "khả dĩ"}), chunk(finish="stop"))
TOOL_STREAM = sse(
    chunk({"role": "assistant", "content": None, "tool_calls": [
        {"index": 0, "id": "call_1", "type": "function", "function": {"name": "trace_serial", "arguments": ""}}]}),
    chunk({"tool_calls": [{"index": 0, "function": {"arguments": '{"serial": "MH2'}}]}),
    chunk({"tool_calls": [{"index": 0, "function": {"arguments": '0-0001"}'}}]}),
    chunk({"tool_calls": [{"index": 1, "id": "call_2", "type": "function",
                           "function": {"name": "trace_forward", "arguments": '{"lot_id": "LOT-B"}'}}]}),
    chunk(finish="tool_calls"),
)


async def test_deepseek_turn_streams_text_and_sets_request_shape():
    seen: list = []
    turn = mock_turn([TEXT_STREAM], seen)
    out = [x async for x in turn([{"role": "user", "content": "hi"}])]
    assert [v for k, v in out if k == "text"] == ["Nguyên nhân ", "khả dĩ"]
    kind, msg = out[-1]
    assert kind == "message" and msg.stop_reason == "end_turn"
    assert [(b.type, b.text) for b in msg.content] == [("text", "Nguyên nhân khả dĩ")]

    req = seen[0]
    assert req["url"] == "https://api.deepseek.com/chat/completions" and req["auth"] == "Bearer ds-key"
    body = req["body"]
    assert body["model"] == "deepseek-flash" and body["stream"] is True
    assert body["thinking"] == {"type": "disabled"}
    assert body["messages"][0]["role"] == "system" and body["tools"] == to_openai_tools(TOOLS)


async def test_deepseek_turn_assembles_streamed_tool_calls():
    out = [x async for x in mock_turn([TOOL_STREAM], [])([{"role": "user", "content": "hi"}])]
    msg = out[-1][1]
    assert msg.stop_reason == "tool_use"
    calls = [b for b in msg.content if b.type == "tool_use"]
    assert [(c.id, c.name, c.input) for c in calls] == [
        ("call_1", "trace_serial", {"serial": "MH20-0001"}), ("call_2", "trace_forward", {"lot_id": "LOT-B"})]


async def test_deepseek_drops_narration_before_tool_calls():
    s = sse(chunk({"content": "I'll start by tracing."}),
            chunk({"tool_calls": [{"index": 0, "id": "c1", "type": "function",
                                   "function": {"name": "trace_serial", "arguments": '{"serial": "MH20-0001"}'}}]}),
            chunk(finish="tool_calls"))
    out = [x async for x in mock_turn([s], [])([{"role": "user", "content": "q"}])]
    assert [k for k, _ in out] == ["message"]                      # no text leaked
    assert [b.type for b in out[-1][1].content] == ["tool_use"]


async def test_deepseek_stop_reason_mapping():
    async def stop_for(finish):
        s = sse(chunk({"content": "x"}), chunk(finish=finish))
        return [x async for x in mock_turn([s], [])([{"role": "user", "content": "q"}])][-1][1].stop_reason
    assert await stop_for("length") == "max_tokens"
    assert await stop_for("content_filter") == "refusal"


async def test_deepseek_malformed_tool_arguments_become_empty_input():
    s = sse(chunk({"tool_calls": [{"index": 0, "id": "c1", "type": "function",
                                   "function": {"name": "trace_serial", "arguments": '{"serial": '}}]}), chunk(finish="tool_calls"))
    msg = [x async for x in mock_turn([s], [])([{"role": "user", "content": "q"}])][-1][1]
    assert msg.content[0].input == {}


async def test_run_agent_end_to_end_over_deepseek(seeded_conn):
    seen: list = []
    answer = sse(chunk({"content": "Nguyên nhân khả dĩ: LOT-B [[cite:IQC-5531]]\n\nKhoanh vùng: 1,000 part"}),
                 chunk(finish="stop"))
    turn = mock_turn([TOOL_STREAM, answer], seen)
    evs = [e async for e in run_agent("q", "CLM-0012", conn=seeded_conn, turn=turn)]
    assert [e.name for e in evs if e.type == "tool_call"] == ["trace_serial", "trace_forward"]
    assert any(e.type == "cite" and e.target_id == "IQC-5531" for e in evs)
    assert evs[-1].type == "done"
    second = seen[1]["body"]["messages"]
    assert [m["role"] for m in second[-3:]] == ["assistant", "tool", "tool"]       # results answer the right call ids
    assert [m["tool_call_id"] for m in second[-2:]] == ["call_1", "call_2"]
    assert json.loads(second[-1]["content"])["delivered_parts"] == 640
