from pydantic import BaseModel

from onethread.queries.common import NotFound

_SQL = """
SELECT c.object_id AS id, c.name, c.attributes->>'status' AS status, c.attributes->>'symptom' AS symptom,
       c.attributes->>'customer' AS customer_id, cu.name AS customer_name,
       c.attributes->>'serial' AS serial, c.attributes->>'received' AS received
FROM objects c LEFT JOIN objects cu ON cu.object_id = c.attributes->>'customer'
WHERE c.type = 'claim'
"""


class Claim(BaseModel):
    id: str
    name: str
    status: str
    symptom: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    serial: str | None = None
    received: str | None = None


def list_claims(conn) -> list[Claim]:
    rows = conn.execute(_SQL + " ORDER BY (c.attributes->>'status' = 'open') DESC, c.object_id DESC").fetchall()
    return [Claim(**r) for r in rows]


def get_claim(conn, claim_id: str) -> Claim:
    row = conn.execute(_SQL + " AND c.object_id = %s", (claim_id,)).fetchone()
    if row is None:
        raise NotFound("claim", claim_id)
    return Claim(**row)
