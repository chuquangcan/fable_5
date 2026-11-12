"""Serials inside a shipment (through its boxes): object links hide volume nodes, so the twin asks here."""
from .common import ensure_exists


def shipment_serials(conn, shipment_id: str, limit: int = 50) -> list[str]:
    ensure_exists(conn, shipment_id)
    rows = conn.execute(
        """SELECT DISTINCT p.from_id AS serial FROM links s
           JOIN links p ON p.to_id = s.from_id AND p.relation = 'packed_in'
           WHERE s.to_id = %s AND s.relation = 'shipped_in'
           ORDER BY serial LIMIT %s""",
        (shipment_id, limit),
    ).fetchall()
    return [r["serial"] for r in rows]
