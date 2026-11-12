from collections.abc import Callable, Iterator
from datetime import date, datetime
from typing import Literal

import psycopg
from fastapi import Body, Depends, FastAPI, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sse_starlette.sse import EventSourceResponse

from onethread import attach, review
from onethread.agent.loop import run_agent
from onethread.agent.providers import active_provider, make_turn
from onethread.agent.replay import default_fixture_path, load_fixture
from onethread.agent.stream import agent_event_stream
from onethread.config import settings
from onethread.db import connect
from onethread.queries import (analysis, claims, docs, events, fault, feed, impact, links, metrics, plant, plant_state,
                               repository, serials, summary, thread_flow, trace)
from onethread.queries.common import NotFound
from onethread.report import ReportDraft, build_report_draft

app = FastAPI(title="One Thread demo API")


def get_conn() -> Iterator[psycopg.Connection]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


@app.exception_handler(NotFound)
def not_found_handler(_: Request, exc: NotFound) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


Conn = Depends(get_conn)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/claims")
def api_claims(conn=Conn) -> list[claims.Claim]:
    return claims.list_claims(conn)


@app.get("/api/claims/{claim_id}")
def api_claim(claim_id: str, conn=Conn) -> claims.Claim:
    return claims.get_claim(conn, claim_id)


@app.get("/api/trace/{serial}")
def api_trace(serial: str, conn=Conn) -> trace.TraceGraph:
    return trace.trace_serial(conn, serial)


@app.get("/api/flow/{id}")
def api_flow(id: str, conn=Conn) -> thread_flow.FlowGraph:
    return thread_flow.build_flow(conn, id)


@app.get("/api/fault-trace")
def api_fault_trace(origin: str, at: datetime | None = None, thread: str | None = None,
                    conn=Conn) -> fault.FaultTrace:
    return fault.fault_trace(conn, origin, at, thread)


@app.get("/api/claims/{claim_id}/fault-trace")
def api_claim_fault_trace(claim_id: str, conn=Conn) -> fault.FaultTrace:
    return fault.claim_fault_trace(conn, claim_id)


@app.get("/api/objects/{object_id}/events")
def api_events(object_id: str, start: datetime | None = None, end: datetime | None = None,
               type: str | None = None, limit: int = Query(2000, ge=1, le=10000),
               conn=Conn) -> list[events.Event]:
    return events.get_events(conn, object_id, start, end, type, limit)


@app.get("/api/objects/{object_id}/links")
def api_links(object_id: str, status: str | None = None, conn=Conn) -> list[links.LinkView]:
    return links.get_links(conn, object_id, status.split(",") if status else None)


@app.get("/api/objects/{object_id}/summary")
def api_summary(object_id: str, conn=Conn) -> summary.NodeSummary:
    return summary.node_summary(conn, object_id)


@app.get("/api/objects/{object_id}/docs")
def api_docs(object_id: str, at: datetime | None = None, conn=Conn) -> list[docs.DocView]:
    return docs.get_docs(conn, object_id, at)


@app.get("/api/metrics/{kpi}")
def api_metrics(kpi: Literal["cpk", "cycle_time"], objects: str, start: datetime | None = None,
                end: datetime | None = None, conn=Conn) -> list[metrics.MetricValue]:
    return metrics.metric(conn, kpi, [o for o in objects.split(",") if o], start, end)


@app.get("/api/compare/{machine}")
def api_compare(machine: str, day: date, conn=Conn) -> list[impact.LotStat]:
    return impact.compare_by_lot(conn, machine, day)


@app.get("/api/impact/{lot}")
def api_impact(lot: str, conn=Conn) -> impact.Impact:
    return impact.trace_forward(conn, lot)


@app.get("/api/shipments/{shipment_id}/serials")
def api_shipment_serials(shipment_id: str, limit: int = Query(50, ge=1, le=1000), conn=Conn) -> list[str]:
    return serials.shipment_serials(conn, shipment_id, limit)


@app.get("/api/reports/{claim_id}/draft")
def api_report_draft(claim_id: str, conn=Conn) -> ReportDraft:
    return build_report_draft(conn, claim_id)


@app.post("/api/documents")
def api_attach_document(file: UploadFile = File(...), target_hint: str | None = Form(None),
                        conn=Conn) -> attach.AttachResult:
    content = file.file.read(attach.MAX_BYTES + 1)  # never buffer more than the limit
    return attach.attach_document(conn, file.filename or "", content, target_hint or None)


@app.get("/api/documents/samples")
def api_document_samples() -> list[str]:
    return attach.list_samples()


@app.post("/api/documents/samples/{name}")
def api_attach_sample(name: str, conn=Conn) -> attach.AttachResult:
    return attach.attach_document(conn, name, attach.sample_content(name), None)


@app.get("/api/documents")
def api_documents(q: str | None = None, type: str | None = None, status: str | None = None,
                  source: str | None = None, conn=Conn) -> list[repository.DocRow]:
    return repository.list_documents(conn, q, type, status, source)


@app.get("/api/documents/{doc_id}")
def api_document(doc_id: str, conn=Conn) -> repository.DocDetail:
    return repository.get_document(conn, doc_id)


@app.get("/api/documents/{doc_id}/file")
def api_document_file(doc_id: str, conn=Conn) -> FileResponse:
    path, media, inline = repository.document_file(conn, doc_id)
    return FileResponse(
        path, media_type=media, filename=path.name.split("_", 1)[-1],
        content_disposition_type="inline" if inline else "attachment",
        # no sniffing into HTML, and an uploaded file never runs scripts in the app's origin
        headers={"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src 'self'"}
        if media != "application/pdf" else {"X-Content-Type-Options": "nosniff"},
    )


@app.get("/api/review-queue")
def api_review_queue(conn=Conn) -> review.ReviewQueue:
    return review.review_queue(conn)


@app.post("/api/links/{link_id}/review")
def api_review_link(link_id: int, decision: review.Decision = Body(..., embed=True),
                    note: str | None = Body(None, embed=True), conn=Conn) -> review.ReviewRecord:
    return review.review_link(conn, link_id, decision, note)


@app.get("/api/machines/{machine_id}/cycle-window")
def api_machine_window(machine_id: str, conn=Conn) -> analysis.MachineWindow:
    return analysis.machine_window(conn, machine_id)


@app.get("/api/lots/{lot_id}/compare")
def api_lot_compare(lot_id: str, conn=Conn) -> analysis.LotCompare:
    return analysis.lot_compare(conn, lot_id)


@app.get("/api/plant")
def api_plant(conn=Conn) -> list[plant.Area]:
    return plant.plant_tree(conn)


@app.get("/api/feed")
def api_feed(conn=Conn) -> list[feed.FeedItem]:
    return feed.list_feed(conn)


@app.get("/api/plant/state")
def api_plant_state(at: datetime | None = None, conn=Conn) -> plant_state.PlantState:
    return plant_state.plant_state(conn, at or feed.DEFAULT_AS_OF)


@app.get("/api/plant/overview")
def api_plant_overview(at: datetime | None = None, conn=Conn) -> plant_state.PlantOverview:
    return plant_state.plant_overview(conn, at or feed.DEFAULT_AS_OF)


@app.get("/api/db/tables")
def api_db_tables(conn=Conn) -> list[repository.TableInfo]:
    return repository.list_tables(conn)


@app.get("/api/db/tables/{name}")
def api_db_table(name: str, q: str | None = None, limit: int = Query(50, ge=1, le=repository.MAX_LIMIT),
                 offset: int = Query(0, ge=0), conn=Conn) -> repository.TablePage:
    return repository.table_rows(conn, name, q, limit, offset)


@app.get("/api/search")
def api_search(q: str, conn=Conn) -> list[repository.SearchHit]:
    return repository.search(conn, q)


@app.post("/api/demo/reset")
def api_demo_reset(conn=Conn) -> dict[str, int]:
    """Undo every demo write: reviews first (a rejected upload link comes back), then the uploads."""
    reviews = review.reset_reviews(conn)
    return {"removed": attach.reset_uploads(conn), "reviews": reviews}


def get_turn_factory() -> Callable[[], Callable]:
    """Builds the Claude turn lazily so missing credentials surface as an SSE `error` event."""
    return make_turn


@app.get("/api/agent/provider")
def api_agent_provider() -> dict[str, str | None]:
    """Which LLM live mode would use right now (from the configured API keys) and the DEMO_MODE."""
    return {**active_provider(), "mode": settings.demo_mode}


@app.get("/api/agent/ask")
async def api_agent_ask(q: str, claim: str = "CLM-0012", mode: Literal["live", "replay", "auto"] | None = None,
                        conn=Conn, make_turn=Depends(get_turn_factory)) -> EventSourceResponse:
    claims.get_claim(conn, claim)  # 404 before the stream starts
    mode = mode or settings.demo_mode  # DEMO_MODE env: live | replay | auto
    fixture = None if mode == "live" else load_fixture(default_fixture_path())

    async def stream():
        async for ev in agent_event_stream(
            q, claim, mode,
            live_factory=lambda: run_agent(q, claim, conn=conn, turn=make_turn()),
            fixture=fixture, timeout_s=settings.agent_timeout_s,
        ):
            yield {"data": ev.model_dump_json()}

    return EventSourceResponse(stream())
