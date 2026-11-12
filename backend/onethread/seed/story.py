from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field


class StoryObject(BaseModel):
    id: str
    type: str
    name: str
    attributes: dict[str, Any] = Field(default_factory=dict)


class StoryAlias(BaseModel):
    object_id: str
    system: str
    local_name: str
    approved_by: str | None = None


class StoryLink(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    relation: str
    tier: int = Field(ge=1, le=5)
    status: Literal["confirmed", "inferred", "pending", "suggested"]
    score: float = 1.0
    rule_version: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class StoryDocument(BaseModel):
    doc_id: str
    chunk_id: str
    file_uri: str
    type: str
    source: str
    page: int
    text: str
    extracted_codes: list[str] = Field(default_factory=list)
    effective_from: datetime


class StoryEvent(BaseModel):
    event_id: str
    type: str
    object_ids: list[str]
    event_time: datetime
    time_kind: Literal["sensor", "transaction", "effective"]
    source: str
    source_record_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class StoryTimeMapping(BaseModel):
    source: str
    offset_s: float
    uncertainty_s: float
    valid_from: datetime


class StoryNotice(BaseModel):
    notice_id: str
    kind: Literal["alert", "4m_change"]
    severity: str | None = None
    category: str | None = None
    title: str
    reason: str
    source: str
    acting: list[str] = Field(default_factory=list)
    object_ids: list[str] = Field(default_factory=list)
    status: Literal["proposed", "watching", "approved", "closed"]
    at: datetime


class Story(BaseModel):
    objects: list[StoryObject]
    aliases: list[StoryAlias]
    links: list[StoryLink]
    documents: list[StoryDocument]
    events: list[StoryEvent]
    time_mappings: list[StoryTimeMapping]
    notices: list[StoryNotice] = Field(default_factory=list)
    volume: dict[str, Any]


def load_story(path: Path) -> dict:
    """Load and validate story.yaml; links keep the YAML key ``from``."""
    story = Story.model_validate(yaml.safe_load(Path(path).read_text(encoding="utf-8")))
    return story.model_dump(by_alias=True)
