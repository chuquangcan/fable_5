import re

from onethread.agent.events import AgentEvent, CiteEv, TextEv

MARKER = re.compile(r"\[\[cite:([A-Za-z0-9._-]+)\]\]")
_PREFIX = "[[cite:"
_PARTIAL = re.compile(r"\[\[cite:[A-Za-z0-9._-]*\]?")


def _could_become_marker(s: str) -> bool:
    return _PREFIX.startswith(s) or _PARTIAL.fullmatch(s) is not None


class CiteParser:
    """Splits a streamed text into `text` / `cite` events, even when a marker spans chunks."""

    def __init__(self, known_ids: set[str]) -> None:
        self.known_ids = known_ids
        self._buf = ""

    def feed(self, chunk: str) -> list[AgentEvent]:
        self._buf += chunk
        return self._drain(final=False)

    def flush(self) -> list[AgentEvent]:
        return self._drain(final=True)

    def _drain(self, final: bool) -> list[AgentEvent]:
        out: list[AgentEvent] = []

        def text(s: str) -> None:
            if not s:
                return
            if out and isinstance(out[-1], TextEv):
                out[-1] = TextEv(out[-1].text + s)
            else:
                out.append(TextEv(s))

        while self._buf:
            i = self._buf.find("[")
            if i == -1:
                text(self._buf)
                self._buf = ""
                break
            if i > 0:
                text(self._buf[:i])
                self._buf = self._buf[i:]
            m = MARKER.match(self._buf)
            if m:
                label = m.group(1)
                out.append(CiteEv(label=label, target_id=label if label in self.known_ids else None))
                self._buf = self._buf[m.end():]
            elif not final and _could_become_marker(self._buf):
                break                      # wait for the rest of the marker
            else:
                text(self._buf[0])         # a lone "[" that is not a marker
                self._buf = self._buf[1:]
        return out
