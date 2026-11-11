"""Agent event union — mirrors `AgentEvent` in frontend/src/agent/reducer.ts."""
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field


class ToolCallEv(BaseModel):
    type: Literal["tool_call"] = "tool_call"
    name: str
    args: dict[str, Any] = {}


class TextEv(BaseModel):
    type: Literal["text"] = "text"
    text: str

    def __init__(self, text: str | None = None, **data: Any) -> None:
        if text is not None:
            data["text"] = text
        super().__init__(**data)


class CiteEv(BaseModel):
    type: Literal["cite"] = "cite"
    label: str
    target_id: str | None = None


class ActionEv(BaseModel):
    type: Literal["action"] = "action"
    action: Literal["open_impact", "open_report"]


class ResetEv(BaseModel):
    type: Literal["reset"] = "reset"


class DoneEv(BaseModel):
    type: Literal["done"] = "done"
    elapsed_s: float


class ErrorEv(BaseModel):
    type: Literal["error"] = "error"
    message: str


AgentEvent = Annotated[
    Union[ToolCallEv, TextEv, CiteEv, ActionEv, ResetEv, DoneEv, ErrorEv],
    Field(discriminator="type"),
]
