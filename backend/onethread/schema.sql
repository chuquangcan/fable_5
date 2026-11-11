-- One Thread core schema (6 tables). Idempotent: drops and recreates everything.
DROP TABLE IF EXISTS time_mappings, links, documents, events, aliases, objects CASCADE;

CREATE TABLE objects (
    object_id  text PRIMARY KEY,
    type       text NOT NULL,
    name       text NOT NULL,
    attributes jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE aliases (
    object_id   text,
    system      text,
    local_name  text,
    approved_by text,
    PRIMARY KEY (system, local_name)
);

CREATE TABLE events (
    event_id         text PRIMARY KEY,
    type             text,
    object_ids       text[],
    event_time       timestamptz,
    time_kind        text CHECK (time_kind IN ('sensor', 'transaction', 'effective')),
    source           text,
    source_record_id text,
    payload          jsonb
);
CREATE INDEX events_object_ids_gin ON events USING GIN (object_ids);
CREATE INDEX events_event_time_idx ON events (event_time);

CREATE TABLE documents (
    doc_id          text,
    chunk_id        text,
    file_uri        text,
    type            text,
    source          text,
    page            int,
    text            text,
    extracted_codes text[],
    effective_from  timestamptz,
    embedding       bytea NULL,
    PRIMARY KEY (doc_id, chunk_id)
);

CREATE TABLE links (
    link_id      bigserial PRIMARY KEY,
    from_id      text,
    to_id        text,
    relation     text,
    tier         int CHECK (tier BETWEEN 1 AND 5),
    status       text CHECK (status IN ('confirmed', 'inferred', 'pending', 'suggested')),
    score        real,
    rule_version text,
    evidence     jsonb
);
CREATE INDEX links_from_id_idx ON links (from_id);
CREATE INDEX links_to_id_idx ON links (to_id);

CREATE TABLE time_mappings (
    source      text,
    offset_s    real,
    uncertainty_s real,
    valid_from  timestamptz
);
