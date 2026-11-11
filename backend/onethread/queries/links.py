from onethread.queries.common import SKIP_TYPES, ensure_exists, node_info
from onethread.queries.trace import Edge


class LinkView(Edge):
    other_id: str
    other_name: str
    direction: str  # "out": object -> other, "in": other -> object


def get_links(conn, object_id: str, statuses: list[str] | None = None) -> list[LinkView]:
    ensure_exists(conn, object_id)
    rows = conn.execute(
        """SELECT from_id, to_id, relation, tier, status, score FROM links
           WHERE (from_id = %(o)s OR to_id = %(o)s)
             AND (%(st)s::text[] IS NULL OR status = ANY(%(st)s))
           ORDER BY tier, link_id""",
        {"o": object_id, "st": statuses or None},
    ).fetchall()
    own_type = node_info(conn, [object_id])[object_id]["type"]
    info = node_info(conn, {r["to_id"] if r["from_id"] == object_id else r["from_id"] for r in rows})
    views = []
    for r in rows:
        out = r["from_id"] == object_id
        other = r["to_id"] if out else r["from_id"]
        i = info.get(other)
        # Hide volume peers (the 1,000 serials of a lot, ...) unless the queried object is itself one.
        if i is None or (i["type"] in SKIP_TYPES and own_type not in SKIP_TYPES):
            continue
        views.append(LinkView(**r, other_id=other, other_name=i["name"], direction="out" if out else "in"))
    return views
