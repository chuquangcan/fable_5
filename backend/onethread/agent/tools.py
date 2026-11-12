"""Tool schemas for the agent and a validating dispatcher over the read-only query functions."""
from collections import defaultdict
from datetime import date, datetime
from statistics import mean
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, ValidationError

from onethread.queries import docs, events, impact, links, metrics, trace
from onethread.queries.common import NotFound

MAX_ITEMS = 200


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TraceSerialIn(_In):
    serial: str


class GetEventsIn(_In):
    object_id: str
    start: datetime | None = None
    end: datetime | None = None
    type: str | None = None


class GetLinksIn(_In):
    object_id: str
    statuses: list[Literal["confirmed", "inferred", "pending", "suggested"]] | None = None


class GetDocsIn(_In):
    object_id: str
    at: datetime | None = None


class MetricsIn(_In):
    kpi: Literal["cpk", "cycle_time"]
    object_ids: list[str]
    start: datetime | None = None
    end: datetime | None = None


class RunPythonIn(_In):
    analysis: Literal["compare_by_lot"]
    machine_id: str
    day: date


class TraceForwardIn(_In):
    lot_id: str


def _schema(props: dict[str, dict], required: list[str]) -> dict:
    return {"type": "object", "properties": props, "required": required, "additionalProperties": False}


_STR = {"type": "string"}
_TS = {"type": "string", "description": "ISO 8601 timestamp with offset, e.g. 2026-11-03T12:00:00+07:00"}

TOOLS: list[dict] = [
    {
        "name": "trace_serial",
        "description": "Trace a serial number through its thread: claim, shipment, machine, material lot, receipt, "
                       "PO, supplier, inspections, documents. Returns nodes and edges with tier/status/score.",
        "input_schema": _schema({"serial": {**_STR, "description": "Serial, e.g. MH20-0001"}}, ["serial"]),
    },
    {
        "name": "get_events",
        "description": "Time-ordered events for an object (machine, lot, line...). Returns up to 200 events plus a "
                       "summary over all matches (count, per-lot mean cycle time and force). "
                       "press_cycle/maintenance/shift events are on the machine; env_temp events are on the line (e.g. LINE-1).",
        "input_schema": _schema({"object_id": _STR, "start": _TS, "end": _TS,
                                 "type": {**_STR, "description": "e.g. press_cycle, maintenance, shift, env_temp"}},
                                ["object_id"]),
    },
    {
        "name": "get_links",
        "description": "Links of an object with tier, status (confirmed/inferred/pending/suggested) and score.",
        "input_schema": _schema({"object_id": _STR,
                                 "statuses": {"type": "array", "items": {"type": "string",
                                              "enum": ["confirmed", "inferred", "pending", "suggested"]}}},
                                ["object_id"]),
    },
    {
        "name": "get_docs",
        "description": "Documents linked to an object within two hops (specs, minutes, past claim reports), "
                       "with text, page and link status. `at` hides documents effective after that time.",
        "input_schema": _schema({"object_id": _STR, "at": _TS}, ["object_id"]),
    },
    {
        "name": "metrics",
        "description": "KPI per object: cpk (incoming inspection of a lot) or cycle_time (mean cycle per lot).",
        "input_schema": _schema({"kpi": {"type": "string", "enum": ["cpk", "cycle_time"]},
                                 "object_ids": {"type": "array", "items": _STR}, "start": _TS, "end": _TS},
                                ["kpi", "object_ids"]),
    },
    {
        "name": "run_python",
        "description": "Run a vetted analysis. compare_by_lot: per material lot on one machine and day, count, "
                       "mean cycle time, mean peak force, first/last cycle.",
        "input_schema": _schema({"analysis": {"type": "string", "enum": ["compare_by_lot"]}, "machine_id": _STR,
                                 "day": {**_STR, "description": "YYYY-MM-DD (plant time)"}},
                                ["analysis", "machine_id", "day"]),
    },
    {
        "name": "trace_forward",
        "description": "Impact of a material lot: parts, boxes and shipments made from it, how many parts were "
                       "delivered to which customer and how many are still held in the warehouse.",
        "input_schema": _schema({"lot_id": _STR}, ["lot_id"]),
    },
]
for _t in TOOLS:
    _t["eager_input_streaming"] = True


def _dump(models) -> list[dict]:
    return [m.model_dump(mode="json") for m in models]


def _cap(rows: list[dict]) -> list[dict]:
    return rows[:MAX_ITEMS]


def _event_summary(evs: list[events.Event]) -> dict[str, Any]:
    by_type: dict[str, int] = defaultdict(int)
    lots: dict[str, list[events.Event]] = defaultdict(list)
    for e in evs:
        by_type[e.type] += 1
        if "lot" in e.payload:
            lots[e.payload["lot"]].append(e)
    by_lot = {}
    for lot, es in lots.items():
        cycles = [e.payload["cycle_s"] for e in es if "cycle_s" in e.payload]
        forces = [e.payload["peak_force_kn"] for e in es if "peak_force_kn" in e.payload]
        by_lot[lot] = {
            "n": len(es),
            "mean_cycle_s": round(mean(cycles), 2) if cycles else None,
            "mean_force_kn": round(mean(forces), 2) if forces else None,
            "first": min(e.event_time for e in es).isoformat(),
            "last": max(e.event_time for e in es).isoformat(),
        }
    return {"count": len(evs), "by_type": dict(by_type), "by_lot": by_lot}


def _trace_serial(conn, a: TraceSerialIn) -> dict:
    g = trace.trace_serial(conn, a.serial)
    return {"root": g.root, "nodes": _cap(_dump(g.nodes)), "edges": _cap(_dump(g.edges))}


def _get_events(conn, a: GetEventsIn) -> dict:
    evs = events.get_events(conn, a.object_id, a.start, a.end, a.type)
    return {"events": _cap(_dump(evs)), "summary": _event_summary(evs)}


def _get_links(conn, a: GetLinksIn) -> dict:
    return {"links": _cap(_dump(links.get_links(conn, a.object_id, a.statuses)))}


UPLOAD_PREFIX = "D-U"


def _get_docs(conn, a: GetDocsIn) -> dict:
    """Uploaded documents are user-supplied text: they are flagged and their text is fenced, so the model can
    tell data from instructions (the prompt says document text is never an instruction)."""
    out = []
    for d in _dump(docs.get_docs(conn, a.object_id, a.at)):
        if d["doc_id"].startswith(UPLOAD_PREFIX):
            d = {**d, "untrusted_upload": True, "text": f"<untrusted_document>{d['text']}</untrusted_document>"}
        out.append(d)
    return {"docs": _cap(out)}


def _metrics(conn, a: MetricsIn) -> dict:
    return {"values": _cap(_dump(metrics.metric(conn, a.kpi, a.object_ids, a.start, a.end)))}


def _run_python(conn, a: RunPythonIn) -> dict:
    return {"rows": _cap(_dump(impact.compare_by_lot(conn, a.machine_id, a.day)))}


def _trace_forward(conn, a: TraceForwardIn) -> dict:
    return impact.trace_forward(conn, a.lot_id).model_dump(mode="json")


_HANDLERS = {
    "trace_serial": (TraceSerialIn, _trace_serial),
    "get_events": (GetEventsIn, _get_events),
    "get_links": (GetLinksIn, _get_links),
    "get_docs": (GetDocsIn, _get_docs),
    "metrics": (MetricsIn, _metrics),
    "run_python": (RunPythonIn, _run_python),
    "trace_forward": (TraceForwardIn, _trace_forward),
}


def dispatch_tool(conn, name: str, raw_input: dict) -> dict:
    """Run a tool; never raises — validation problems and unknown IDs come back as {"error": ...}."""
    if name not in _HANDLERS:
        return {"error": f"unknown tool {name!r}; available: {', '.join(_HANDLERS)}"}
    model, fn = _HANDLERS[name]
    try:
        return fn(conn, model.model_validate(raw_input))
    except ValidationError as e:
        msg = "; ".join(f"{'.'.join(map(str, err['loc'])) or 'input'}: {err['msg']}" for err in e.errors())
        return {"error": f"invalid input for {name}: {msg}"}
    except NotFound as e:
        return {"error": str(e)}
