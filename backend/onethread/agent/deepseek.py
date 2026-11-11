"""DeepSeek (OpenAI-format chat completions) as a drop-in turn for run_agent.

run_agent keeps Anthropic-style history/blocks; this module converts at the edge so the loop,
cite parser and tools stay provider-neutral.
"""
import json
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any, Literal

import openai

from onethread.agent.prompt import SYSTEM_PROMPT
from onethread.agent.tools import TOOLS

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-flash"  # the only DeepSeek model this demo uses (flash tier)
MAX_TOKENS = 8000

_STOP_REASONS = {"stop": "end_turn", "length": "max_tokens", "content_filter": "refusal", "tool_calls": "tool_use"}


def _get(obj: Any, name: str, default: Any = None) -> Any:
    return obj.get(name, default) if isinstance(obj, dict) else getattr(obj, name, default)


def to_openai_tools(tools: list[dict]) -> list[dict]:
    return [{"type": "function",
             "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
            for t in tools]


def to_openai_messages(messages: list) -> list[dict]:
    out: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in messages:
        role, content = _get(m, "role"), _get(m, "content")
        if isinstance(content, str):
            out.append({"role": role, "content": content})
        elif role == "assistant":
            text = "".join(_get(b, "text", "") for b in content if _get(b, "type") == "text")
            calls = [{"id": _get(b, "id"), "type": "function",
                      "function": {"name": _get(b, "name"), "arguments": json.dumps(_get(b, "input") or {}, ensure_ascii=False)}}
                     for b in content if _get(b, "type") == "tool_use"]
            msg: dict[str, Any] = {"role": "assistant", "content": text or None}
            if calls:
                msg["tool_calls"] = calls
            out.append(msg)
        else:  # user turn made of tool_result blocks → one `tool` message each
            out.extend({"role": "tool", "tool_call_id": _get(b, "tool_use_id"), "content": _get(b, "content")}
                       for b in content if _get(b, "type") == "tool_result")
    return out


class DeepSeekTurn:
    def __init__(self, api_key: str, *, base_url: str = DEEPSEEK_BASE_URL, http_client=None) -> None:
        self.model = DEEPSEEK_MODEL
        self.client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url, http_client=http_client)

    async def __call__(self, messages: list) -> AsyncIterator[tuple[Literal["text", "message"], Any]]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=to_openai_messages(messages),
            tools=to_openai_tools(TOOLS),
            max_tokens=MAX_TOKENS,
            temperature=0.2,
            stream=True,
            # Thinking mode would require echoing reasoning_content back on every tool turn
            # and is slower; flash without it is enough for this tool-driven demo.
            extra_body={"thinking": {"type": "disabled"}},
        )
        text: list[str] = []  # held back until we know whether this turn calls tools
        calls: dict[int, dict[str, str]] = {}
        finish: str | None = None
        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta
            if delta.content:
                text.append(delta.content)
            for tc in delta.tool_calls or []:
                slot = calls.setdefault(tc.index, {"id": "", "name": "", "arguments": ""})
                if tc.id:
                    slot["id"] = tc.id
                if tc.function and tc.function.name:
                    slot["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    slot["arguments"] += tc.function.arguments
            if choice.finish_reason:
                finish = choice.finish_reason

        content: list[Any] = []
        if text and not calls:
            # Final answer: release it now. When the turn calls tools, flash's "I'll start by..."
            # narration is dropped — it would otherwise end up glued to the Vietnamese answer.
            for piece in text:
                yield ("text", piece)
            content.append(SimpleNamespace(type="text", text="".join(text)))
        for i in sorted(calls):
            c = calls[i]
            try:
                args = json.loads(c["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {}  # dispatch_tool will report the missing fields back to the model
            content.append(SimpleNamespace(type="tool_use", id=c["id"] or f"call_{i}", name=c["name"],
                                           input=args if isinstance(args, dict) else {}))
        stop = "tool_use" if calls else _STOP_REASONS.get(finish or "stop", "end_turn")
        yield ("message", SimpleNamespace(content=content, stop_reason=stop))
