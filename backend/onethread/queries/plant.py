"""Plant view: the plant's own assets grouped by area (warehouse, production, quality, finished goods).

The product view follows one serial across the chain; this view lists what sits in the plant so a
machine, a hopper or a lot can be opened on its own, over time, without a claim.
"""
from typing import Any

import psycopg
from pydantic import BaseModel

from onethread.flow import FLOW_STATUSES
from onethread.review import REVIEWABLE

# (area id, label, object types in display order)
AREAS: list[tuple[str, str, list[str]]] = [
    ("kho_nl", "Raw materials warehouse", ["receipt", "lot"]),
    ("san_xuat", "Production", ["line", "hopper", "machine"]),
    ("chat_luong", "Quality", ["inspection"]),
    ("kho_tp", "Finished goods warehouse · shipping", ["shipment"]),
]
TYPE_LABEL = {"receipt": "Goods receipt", "lot": "Component lot", "line": "Line", "hopper": "Hopper",
              "machine": "Machine", "inspection": "IQC", "shipment": "Shipment"}
VOLUME = {"san_xuat": ("serial", "serial"), "kho_tp": ("box", "boxes")}


class Asset(BaseModel):
    id: str
    type: str
    name: str
    sub: str
    events: int
    docs: int
    to_review: int


class AssetGroup(BaseModel):
    type: str
    label: str
    items: list[Asset]


class Area(BaseModel):
    id: str
    label: str
    groups: list[AssetGroup]
    volume: str | None = None  # e.g. "1,000 serial" (volume nodes are counted, not listed)


def _sub(type: str, a: dict[str, Any], line_of: dict[str, str]) -> str:
    if type == "lot":
        return " · ".join(x for x in (str(a.get("part", "")), f"{a['qty']:,} pcs" if a.get("qty") else "") if x)
    if type == "receipt":
        return str(a.get("received_at", ""))[:10]
    if type == "machine":
        return line_of.get(a.get("_id", ""), "no line assigned")
    if type == "inspection":
        return " · ".join(x for x in (str(a.get("lot", "")), f"Cpk {a['cpk']}" if a.get("cpk") is not None else "") if x)
    if type == "shipment":
        return " · ".join(str(x) for x in (a.get("status"), a.get("date")) if x)
    return ""


def plant_tree(conn: psycopg.Connection) -> list[Area]:
    types = [t for _, _, ts in AREAS for t in ts]
    objs = conn.execute("SELECT object_id, type, name, attributes FROM objects WHERE type = ANY(%s) ORDER BY object_id",
                        (types,)).fetchall()
    ids = [o["object_id"] for o in objs]
    events = {r["id"]: r["n"] for r in conn.execute(
        "SELECT id, count(*) AS n FROM (SELECT unnest(object_ids) AS id FROM events) e WHERE id = ANY(%s) GROUP BY id",
        (ids,))}
    docs = {r["id"]: r["n"] for r in conn.execute(
        """SELECT o.id, count(DISTINCT d.doc_id) AS n
           FROM (SELECT from_id AS a, to_id AS b FROM links UNION ALL SELECT to_id, from_id FROM links) l
           JOIN unnest(%s::text[]) AS o(id) ON o.id = l.a
           JOIN documents d ON d.doc_id = l.b GROUP BY o.id""", (ids,))}
    review = {r["id"]: r["n"] for r in conn.execute(
        """SELECT id, count(*) AS n FROM (SELECT from_id AS id FROM links WHERE status = ANY(%(s)s)
           UNION ALL SELECT to_id FROM links WHERE status = ANY(%(s)s)) x WHERE id = ANY(%(i)s) GROUP BY id""",
        {"s": list(REVIEWABLE), "i": ids})}
    line_of = {r["from_id"]: r["name"] for r in conn.execute(
        """SELECT l.from_id, o.name FROM links l JOIN objects o ON o.object_id = l.to_id
           WHERE l.relation = 'part_of' AND l.status = ANY(%s)""", (list(FLOW_STATUSES),))}
    volume = {r["type"]: r["n"] for r in conn.execute(
        "SELECT type, count(*) AS n FROM objects WHERE type IN ('serial', 'box') GROUP BY type")}

    areas = []
    for area_id, label, area_types in AREAS:
        groups = []
        for t in area_types:
            items = [Asset(id=o["object_id"], type=t, name=o["name"],
                           sub=_sub(t, {**(o["attributes"] or {}), "_id": o["object_id"]}, line_of),
                           events=events.get(o["object_id"], 0), docs=docs.get(o["object_id"], 0),
                           to_review=review.get(o["object_id"], 0))
                     for o in objs if o["type"] == t]
            if items:
                groups.append(AssetGroup(type=t, label=TYPE_LABEL.get(t, t), items=items))
        vol = VOLUME.get(area_id)
        areas.append(Area(id=area_id, label=label, groups=groups,
                          volume=f"{volume[vol[0]]:,} {vol[1]}" if vol and volume.get(vol[0]) else None))
    return areas
