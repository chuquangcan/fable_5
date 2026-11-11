"""Recorded agent runs: load, replay with capped pacing, and record a fresh one from live Claude."""
import asyncio
import json
import os
import sys
import time
from collections.abc import AsyncIterator
from pathlib import Path

from pydantic import BaseModel

from onethread.agent.events import AgentEvent
from onethread.config import settings

MAX_DELAY_MS = 400
BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_QUESTION = "Vì sao MH20-0001 của CLM-0012 kêu to? Tìm nguyên nhân gốc và phạm vi ảnh hưởng."


class FixtureEvent(BaseModel):
    delay_ms: int
    event: AgentEvent


class Fixture(BaseModel):
    question: str
    events: list[FixtureEvent]


def default_fixture_path() -> Path:
    p = Path(settings.replay_fixture)
    return p if p.is_absolute() else (BACKEND_DIR / p).resolve()


def load_fixture(path: str | Path) -> Fixture:
    return Fixture.model_validate_json(Path(path).read_text(encoding="utf-8"))


async def replay_events(fx: Fixture, max_delay_ms: int | None = None) -> AsyncIterator[AgentEvent]:
    cap = MAX_DELAY_MS if max_delay_ms is None else max_delay_ms
    for item in fx.events:
        delay = min(item.delay_ms, cap)
        if delay > 0:
            await asyncio.sleep(delay / 1000)
        yield item.event


async def record_run(question: str, claim_id: str, out_path: str | Path, *,
                     live: AsyncIterator[AgentEvent] | None = None) -> None:
    """Run the agent live and write {question, events:[{delay_ms, event}]}.

    Refuses to touch `out_path` unless the run ended with `done` and produced no `error`,
    so a flaky recording can never clobber a good fixture.
    """
    if live is None:
        from onethread.agent.loop import run_agent
        from onethread.agent.providers import make_turn
        from onethread.db import connect

        live = run_agent(question, claim_id, conn=connect(), turn=make_turn())
    events: list[dict] = []
    last = time.monotonic()
    async for ev in live:
        now = time.monotonic()
        events.append({"delay_ms": round((now - last) * 1000), "event": ev.model_dump(mode="json")})
        last = now
    types = [e["event"]["type"] for e in events]
    if not types or types[-1] != "done" or "error" in types:
        raise RuntimeError(f"recording failed (event types: {types[-3:]}); fixture left untouched")
    out = Path(out_path)
    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.write_text(json.dumps({"question": question, "events": events}, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    os.replace(tmp, out)


def _main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] != "record":
        print("usage: python -m onethread.agent.replay record [out_path]", file=sys.stderr)
        return 2
    out = Path(argv[2]) if len(argv) > 2 else default_fixture_path()
    question = DEFAULT_QUESTION
    if out.exists():
        try:
            question = load_fixture(out).question
        except Exception:  # noqa: BLE001 — a broken old fixture should not block re-recording
            pass
    asyncio.run(record_run(question, "CLM-0012", out))
    print(f"recorded {out} — review the content before committing it")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
