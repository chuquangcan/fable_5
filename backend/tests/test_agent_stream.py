import asyncio
import json

import anthropic
import httpx2
import pytest

from onethread.agent.events import CiteEv, DoneEv, ErrorEv, TextEv, ToolCallEv
from onethread.agent.replay import Fixture, load_fixture, record_run, replay_events
from onethread.agent.stream import agent_event_stream

FX_EVENTS = [
    ToolCallEv(name="trace_serial", args={"serial": "MH20-0001"}),
    TextEv("Probable cause: LOT-B "),
    CiteEv(label="IQC-5531", target_id="IQC-5531"),
    DoneEv(elapsed_s=21),
]
FX = Fixture.model_validate({"question": "q", "events": [{"delay_ms": 0, "event": e.model_dump()} for e in FX_EVENTS]})


def fake_request():
    return httpx2.Request("POST", "https://api.anthropic.test/v1/messages")


async def collect(mode, live, timeout_s=5, fixture=FX):
    return [e async for e in agent_event_stream("q", "CLM-0012", mode, live_factory=live,
                                                fixture=fixture, timeout_s=timeout_s)]


async def test_auto_falls_back_after_partial_output():   # Review Focus #4
    async def live():
        yield TextEv("partial")
        raise anthropic.APIConnectionError(request=fake_request())

    evs = [e async for e in agent_event_stream("q", "CLM-0012", "auto",
           live_factory=lambda: live(), fixture=FX, timeout_s=5)]
    i = [e.type for e in evs].index("reset")
    assert evs[0].type == "text" and evs[i+1:] == FX_EVENTS


async def test_auto_times_out_to_replay():
    async def slow():
        await asyncio.sleep(10)
        yield TextEv("never")

    evs = [e async for e in agent_event_stream("q", "CLM-0012", "auto",
           live_factory=lambda: slow(), fixture=FX, timeout_s=0.1)]
    assert evs[0].type == "reset" and evs[-1].type == "done"


async def test_auto_timeout_counts_total_time_not_per_event():
    async def drip():
        for _ in range(10):
            await asyncio.sleep(0.05)
            yield TextEv("x")

    evs = await collect("auto", lambda: drip(), timeout_s=0.2)
    assert "reset" in [e.type for e in evs] and evs[-3:] == FX_EVENTS[-3:]


async def test_replay_mode_never_calls_live():
    def live():
        raise AssertionError("live must not be called in replay mode")

    assert await collect("replay", live) == FX_EVENTS


async def test_auto_passes_live_events_through_untouched():
    async def live():
        yield TextEv("a")
        yield DoneEv(elapsed_s=1)

    assert await collect("auto", lambda: live()) == [TextEv("a"), DoneEv(elapsed_s=1)]


async def test_auto_live_error_event_triggers_replay_and_is_not_forwarded():
    async def live():
        yield TextEv("a")
        yield ErrorEv(message="refusal")

    evs = await collect("auto", lambda: live())
    assert [e.type for e in evs][:2] == ["text", "reset"] and not any(e.type == "error" for e in evs)
    assert evs[2:] == FX_EVENTS


async def test_auto_falls_back_on_unexpected_live_exception_too():
    async def live():
        raise RuntimeError("could not resolve authentication method")
        yield  # pragma: no cover

    evs = await collect("auto", lambda: live())
    assert evs[0].type == "reset" and evs[1:] == FX_EVENTS


async def test_live_mode_reports_error_without_fallback():
    async def live():
        yield TextEv("a")
        raise anthropic.APIConnectionError(request=fake_request())

    evs = await collect("live", lambda: live())
    assert [e.type for e in evs] == ["text", "error"] and "Connection" in evs[1].message


async def test_live_mode_works_without_a_fixture():
    async def live():
        yield DoneEv(elapsed_s=1)

    assert await collect("live", lambda: live(), fixture=None) == [DoneEv(elapsed_s=1)]


# ---- replay / fixture ----

async def test_replay_caps_each_delay():
    fx = Fixture.model_validate({"question": "q", "events": [
        {"delay_ms": 60_000, "event": {"type": "text", "text": "a"}},
        {"delay_ms": 60_000, "event": {"type": "done", "elapsed_s": 1}}]})
    out = await asyncio.wait_for(_drain(replay_events(fx, max_delay_ms=5)), timeout=2)
    assert [e.type for e in out] == ["text", "done"]


async def _drain(it):
    return [e async for e in it]


def test_shipped_fixture_loads(tmp_path):
    from onethread.agent.replay import default_fixture_path
    fx = load_fixture(default_fixture_path())
    assert fx.question.startswith("Why is MH20-0001") and fx.events[-1].event.type == "done"
    assert sum(e.event.type == "tool_call" for e in fx.events) == 7


async def test_record_run_writes_fixture_with_real_gaps(tmp_path):
    async def live():
        yield TextEv("a")
        await asyncio.sleep(0.05)
        yield DoneEv(elapsed_s=1)

    out = tmp_path / "fx.json"
    await record_run("question text", "CLM-0012", out, live=live())
    raw = json.loads(out.read_text())
    assert raw["question"] == "question text" and [e["event"]["type"] for e in raw["events"]] == ["text", "done"]
    assert raw["events"][1]["delay_ms"] >= 40
    assert load_fixture(out).events[0].event == TextEv("a")


async def test_record_run_refuses_to_overwrite_with_failed_run(tmp_path):
    out = tmp_path / "fx.json"
    out.write_text("keep me")

    async def live():
        yield TextEv("a")
        yield ErrorEv(message="boom")

    with pytest.raises(RuntimeError):
        await record_run("q", "CLM-0012", out, live=live())
    assert out.read_text() == "keep me"
