from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from onethread.db import apply_schema
from onethread.seed.generate import generate_volume
from onethread.seed.story import load_story


def seed(conn: psycopg.Connection, story_path: Path) -> None:
    """Drop/create the schema and load story.yaml plus the generated volume, in one transaction."""
    story = load_story(Path(story_path))
    vol = generate_volume(story)
    with conn.transaction():
        apply_schema(conn)
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO objects (object_id, type, name, attributes) VALUES (%s, %s, %s, %s)",
                [(o["id"], o["type"], o["name"], Jsonb(o["attributes"])) for o in story["objects"]]
                + [(o["object_id"], o["type"], o["name"], Jsonb(o["attributes"])) for o in vol.objects],
            )
            cur.executemany(
                "INSERT INTO aliases (object_id, system, local_name, approved_by) VALUES (%s, %s, %s, %s)",
                [(a["object_id"], a["system"], a["local_name"], a["approved_by"]) for a in story["aliases"]],
            )
            cur.executemany(
                "INSERT INTO links (from_id, to_id, relation, tier, status, score, rule_version, evidence)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                [(l["from"], l["to"], l["relation"], l["tier"], l["status"], l["score"],
                  l["rule_version"], Jsonb(l["evidence"])) for l in story["links"]]
                + [(l["from_id"], l["to_id"], l["relation"], l["tier"], l["status"], l["score"],
                    l["rule_version"], Jsonb(l["evidence"])) for l in vol.links],
            )
            cur.executemany(
                "INSERT INTO documents (doc_id, chunk_id, file_uri, type, source, page, text,"
                " extracted_codes, effective_from) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                [(d["doc_id"], d["chunk_id"], d["file_uri"], d["type"], d["source"], d["page"],
                  d["text"], d["extracted_codes"], d["effective_from"]) for d in story["documents"]],
            )
            cur.executemany(
                "INSERT INTO events (event_id, type, object_ids, event_time, time_kind, source,"
                " source_record_id, payload) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                [(e["event_id"], e["type"], e["object_ids"], e["event_time"], e["time_kind"],
                  e["source"], e["source_record_id"], Jsonb(e["payload"])) for e in story["events"]]
                + [(e["event_id"], e["type"], e["object_ids"], e["event_time"], e["time_kind"],
                    e["source"], e["source_record_id"], Jsonb(e["payload"])) for e in vol.events],
            )
            cur.executemany(
                "INSERT INTO time_mappings (source, offset_s, uncertainty_s, valid_from) VALUES (%s, %s, %s, %s)",
                [(t["source"], t["offset_s"], t["uncertainty_s"], t["valid_from"]) for t in story["time_mappings"]],
            )
            cur.executemany(
                "INSERT INTO notices (notice_id, kind, severity, category, title, reason, source, acting, object_ids,"
                " status, at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                [(n["notice_id"], n["kind"], n["severity"], n["category"], n["title"], n["reason"], n["source"],
                  n["acting"], n["object_ids"], n["status"], n["at"]) for n in story["notices"]],
            )
