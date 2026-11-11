import sys
from pathlib import Path

from onethread.db import connect
from onethread.seed import seed

DEFAULT_STORY = Path(__file__).resolve().parents[3] / "data" / "story.yaml"


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_STORY
    with connect() as conn:
        seed(conn, path)
    print(f"seeded from {path}")


if __name__ == "__main__":
    main()
