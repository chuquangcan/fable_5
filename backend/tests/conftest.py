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


@pytest.fixture
def seeded_conn(conn, story_path):
    """`conn` with the story seeded (re-seeds if an earlier test wiped the schema)."""
    from onethread.seed import seed

    if conn.execute("select count(*) as n from objects").fetchone()["n"] == 0:
        seed(conn, story_path)
    return conn
