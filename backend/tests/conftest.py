import os
from pathlib import Path

import pytest

from onethread.db import apply_schema, connect
from onethread.seed.story import load_story

REPO = Path(__file__).resolve().parents[2]
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://onethread:onethread@localhost:5433/onethread_test"
)


@pytest.fixture(scope="session")
def story_path() -> Path:
    return REPO / "data" / "story.yaml"


@pytest.fixture(scope="session")
def story(story_path):
    return load_story(story_path)


@pytest.fixture(scope="session")
def conn():
    c = connect(TEST_DATABASE_URL)
    apply_schema(c)
    yield c
    c.close()


_seeded_this_session = False


@pytest.fixture
def seeded_conn(conn, story_path):
    """`conn` freshly seeded once per session; re-seeds if a later test wiped the schema."""
    global _seeded_this_session
    from onethread.seed import seed

    empty = conn.execute("select count(*) as n from objects").fetchone()["n"] == 0
    if empty or not _seeded_this_session:
        seed(conn, story_path)
        _seeded_this_session = True
    return conn


@pytest.fixture
def client(seeded_conn):
    """API client whose `get_conn` dependency yields the seeded test DB."""
    from fastapi.testclient import TestClient

    from onethread.api import app, get_conn

    app.dependency_overrides[get_conn] = lambda: seeded_conn
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---- agent test helpers: scripted Claude turns, no network ----
from types import SimpleNamespace  # noqa: E402


def tool_use_msg(name: str, args: dict, tool_id: str = "toolu_1"):
    block = SimpleNamespace(type="tool_use", id=tool_id, name=name, input=args)
    return SimpleNamespace(content=[block], stop_reason="tool_use")


def text_msg(text: str, stop_reason: str = "end_turn"):
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)], stop_reason=stop_reason)


def refusal_msg():
    return SimpleNamespace(content=[], stop_reason="refusal")


class FakeTurn:
    """Replays scripted final messages; text blocks are streamed in small chunks. Records each request."""

    def __init__(self, messages: list):
        self._script = list(messages)
        self.requests: list[list] = []

    async def __call__(self, messages):
        self.requests.append(list(messages))
        msg = self._script.pop(0)
        for block in msg.content:
            if block.type == "text":
                for i in range(0, len(block.text), 7):
                    yield ("text", block.text[i : i + 7])
        yield ("message", msg)
