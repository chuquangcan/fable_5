"""DEMO_MODE switch: live Claude, recorded replay, or live with automatic fallback to replay."""
import asyncio
import time
from collections.abc import AsyncIterator, Callable
from typing import Literal

from onethread.agent.events import AgentEvent, ErrorEv, ResetEv
from onethread.agent.replay import Fixture, replay_events


async def _live_with_deadline(live: AsyncIterator[AgentEvent], timeout_s: float) -> AsyncIterator[AgentEvent]:
    """Yield live events; the deadline covers the whole run, not each event."""
    deadline = time.monotonic() + timeout_s
    it = live.__aiter__()
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError
            try:
                yield await asyncio.wait_for(it.__anext__(), remaining)
            except StopAsyncIteration:
                return
    finally:
        aclose = getattr(it, "aclose", None)
        if aclose:
            await aclose()


async def agent_event_stream(question: str, claim_id: str, mode: Literal["live", "replay", "auto"], *,
                             live_factory: Callable[[], AsyncIterator[AgentEvent]],
                             fixture: Fixture | None, timeout_s: float) -> AsyncIterator[AgentEvent]:
    if mode == "replay":
        async for ev in replay_events(fixture):
            yield ev
        return

    if mode == "live":
        try:
            async for ev in live_factory():
                yield ev
        except Exception as e:  # noqa: BLE001 — the client gets a terminal error event
            yield ErrorEv(message=f"{type(e).__name__}: {e}")
        return

    # auto: partial live output is already on the wire when a failure happens, so tell the
    # client to discard it (`reset`) and then replay the whole recording.
    failed = False
    try:
        async for ev in _live_with_deadline(live_factory(), timeout_s):
            if ev.type == "error":
                failed = True
                break
            yield ev
    except Exception:  # noqa: BLE001 — any live failure (API, network, timeout, missing credentials) falls back
        failed = True
    if failed:
        yield ResetEv()
        async for ev in replay_events(fixture):
            yield ev
