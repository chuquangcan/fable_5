"""Pick the LLM provider from the API keys that are actually configured."""
import os
from collections.abc import Callable, Mapping
from typing import Literal

Provider = Literal["anthropic", "deepseek"]
KEYS: dict[str, str] = {"anthropic": "ANTHROPIC_API_KEY", "deepseek": "DEEPSEEK_API_KEY"}


class NoProviderError(RuntimeError):
    pass


def _has(env: Mapping[str, str], name: str) -> bool:
    return bool(env.get(name, "").strip())


def resolve_provider(env: Mapping[str, str] | None = None) -> Provider | None:
    """AGENT_PROVIDER=auto (default): Claude if ANTHROPIC_API_KEY is set, else DeepSeek if DEEPSEEK_API_KEY is set.

    AGENT_PROVIDER=anthropic|deepseek forces one and requires its key. Empty values count as unset.
    """
    env = os.environ if env is None else env
    wanted = (env.get("AGENT_PROVIDER") or "auto").strip().lower()
    if wanted == "auto":
        return next((p for p, key in KEYS.items() if _has(env, key)), None)
    if wanted not in KEYS:
        raise NoProviderError(f"AGENT_PROVIDER={wanted!r} is not valid (auto | anthropic | deepseek)")
    if not _has(env, KEYS[wanted]):
        raise NoProviderError(f"AGENT_PROVIDER={wanted} but {KEYS[wanted]} is not set")
    return wanted  # type: ignore[return-value]


def make_turn(env: Mapping[str, str] | None = None) -> Callable:
    env = os.environ if env is None else env
    provider = resolve_provider(env)
    if provider == "deepseek":
        from onethread.agent.deepseek import DeepSeekTurn

        return DeepSeekTurn(api_key=env["DEEPSEEK_API_KEY"].strip())
    if provider == "anthropic":
        import anthropic

        from onethread.agent.loop import ClaudeTurn
        from onethread.config import settings

        client = anthropic.AsyncAnthropic(api_key=env["ANTHROPIC_API_KEY"].strip())
        return ClaudeTurn(client, settings.agent_model, settings.agent_effort)
    raise NoProviderError("No API key: set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY in .env")


def active_provider(env: Mapping[str, str] | None = None) -> dict[str, str | None]:
    from onethread.agent.deepseek import DEEPSEEK_MODEL
    from onethread.config import settings

    try:
        provider = resolve_provider(env)
    except NoProviderError:
        provider = None
    model = {"anthropic": settings.agent_model, "deepseek": DEEPSEEK_MODEL}.get(provider or "")
    return {"provider": provider, "model": model}
