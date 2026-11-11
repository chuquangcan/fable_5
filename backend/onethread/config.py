import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Repo-root .env (git-ignored) holds the API keys. Real environment variables win over the file.
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: _env(
            "DATABASE_URL", "postgresql://onethread:onethread@localhost:5433/onethread"
        )
    )
    demo_mode: str = field(default_factory=lambda: _env("DEMO_MODE", "auto"))
    agent_model: str = "claude-opus-5-5"
    agent_effort: str = field(default_factory=lambda: _env("AGENT_EFFORT", "low"))
    agent_timeout_s: int = field(default_factory=lambda: int(_env("AGENT_TIMEOUT_S", "30")))
    replay_fixture: str = "../frontend/public/fixtures/agent_clm0012.json"
    uploads_dir: str = field(
        default_factory=lambda: _env("UPLOADS_DIR", str(Path(__file__).resolve().parents[1] / "var" / "uploads"))
    )


settings = Settings()
