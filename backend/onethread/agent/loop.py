"""Manual tool-use loop: stream text through CiteParser, run read-only tools, repeat until end_turn."""
import json
import time
from collections.abc import AsyncIterator, Callable
from typing import Any, Literal

import anthropic

from onethread.agent.cites import CiteParser
from onethread.agent.events import (ActionEv, AgentEvent, DoneEv, ErrorEv, TextEv, ToolCallEv)
from onethread.agent.prompt import SYSTEM_PROMPT
from onethread.agent.tools import TOOLS, dispatch_tool

BETAS = ["server-side-fallback-2026-07-01"]
SIDE_EVENT_TYPES = ("maintenance", "shift", "env_temp", "goods_receipt", "lot_loaded")


class ClaudeTurn:
    """One model call: yields ("text", chunk) while streaming, then ("message", final_message)."""

    def __init__(self, client: anthropic.AsyncAnthropic, model: str, effort: str) -> None:
        self.client, self.model, self.effort = client, model, effort

    async def __call__(self, messages: list) -> AsyncIterator[tuple[Literal["text", "message"], Any]]:
        async with self.client.beta.messages.stream(
            model=self.model,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
            output_config={"effort": self.effort},
            betas=BETAS,
            fallbacks="default",
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield ("text", event.delta.text)
            yield ("message", await stream.get_final_message())


def load_known_ids(conn) -> set[str]:
    """Every ID the agent may cite: objects, documents, event sources and side-event record IDs."""
    ids: set[str] = set()
    ids.update(r["object_id"] for r in conn.execute("SELECT object_id FROM objects"))
    ids.update(r["doc_id"] for r in conn.execute("SELECT DISTINCT doc_id FROM documents"))
    ids.update(r["source"] for r in conn.execute("SELECT DISTINCT source FROM events WHERE source IS NOT NULL"))
    ids.update(
        r["source_record_id"]
        for r in conn.execute(
            "SELECT DISTINCT source_record_id FROM events WHERE type = ANY(%s) AND source_record_id IS NOT NULL",
            (list(SIDE_EVENT_TYPES),),
        )
    )
    return ids


async def run_agent(question: str, claim_id: str, *, conn, turn: Callable,
                    max_tool_calls: int = 14, known_ids: set[str] | None = None) -> AsyncIterator[AgentEvent]:
    started = time.monotonic()
    parser = CiteParser(known_ids if known_ids is not None else load_known_ids(conn))
    messages: list[dict] = [{"role": "user", "content": f"{question}\n\nContext: claim {claim_id}"}]
    tool_calls = 0

    def done() -> DoneEv:
        return DoneEv(elapsed_s=round(time.monotonic() - started, 1))

    while True:
        turn_text: list[str] = []
        message = None
        async for kind, value in turn(messages):
            if kind == "text":
                turn_text.append(value)
                for ev in parser.feed(value):
                    yield ev
            else:
                message = value
        for ev in parser.flush():
            yield ev

        stop = message.stop_reason
        if stop == "refusal":
            yield ErrorEv(message="Claude từ chối trả lời yêu cầu này.")
            return
        if stop == "max_tokens":
            yield done()
            return

        if stop == "tool_use":
            blocks = [b for b in message.content if b.type == "tool_use"]
            if tool_calls + len(blocks) > max_tool_calls:
                yield TextEv("Đã dừng vì quá số bước.")
                yield done()
                return
            messages.append({"role": "assistant", "content": message.content})
            results = []
            for b in blocks:
                tool_calls += 1
                args = dict(b.input)
                yield ToolCallEv(name=b.name, args=args)
                out = dispatch_tool(conn, b.name, args)
                result: dict[str, Any] = {"type": "tool_result", "tool_use_id": b.id,
                                          "content": json.dumps(out, ensure_ascii=False)}
                if "error" in out:
                    result["is_error"] = True
                results.append(result)
            messages.append({"role": "user", "content": results})
            continue

        # end_turn (or anything else that is not a tool request)
        if "Khoanh vùng" in "".join(turn_text):
            yield ActionEv(action="open_impact")
        yield ActionEv(action="open_report")
        yield done()
        return
