from collections.abc import Iterator
from datetime import date, datetime
from typing import Literal

import psycopg
from fastapi import Depends, FastAPI, Query, Request
from fastapi.responses import JSONResponse

from onethread.db import connect
from onethread.queries import claims, docs, events, impact, links, metrics, trace
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


@app.get("/api/objects/{object_id}/events")
def api_events(object_id: str, start: datetime | None = None, end: datetime | None = None,
               type: str | None = None, limit: int = Query(2000, ge=1, le=10000),
               conn=Conn) -> list[events.Event]:
    return events.get_events(conn, object_id, start, end, type, limit)


@app.get("/api/objects/{object_id}/links")
def api_links(object_id: str, status: str | None = None, conn=Conn) -> list[links.LinkView]:
    return links.get_links(conn, object_id, status.split(",") if status else None)


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


@app.get("/api/reports/{claim_id}/draft")
def api_report_draft(claim_id: str, conn=Conn) -> ReportDraft:
    return build_report_draft(conn, claim_id)
