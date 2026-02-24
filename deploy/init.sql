-- BikeShareYEG — Database Initialization
-- Runs automatically on first Postgres start via docker-entrypoint-initdb.d.
--
-- The shared_networks table stores published bike-share network designs.
-- The `data` JSONB column holds the full SavedNetwork payload, versioned via
-- a `_schema_version` key so the application can migrate old rows on read
-- without requiring SQL migrations.

CREATE TABLE IF NOT EXISTS shared_networks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_token    TEXT        NOT NULL,
    name           TEXT        NOT NULL,
    description    TEXT        NOT NULL DEFAULT '',
    author         TEXT        NOT NULL DEFAULT '',
    station_count  INT         NOT NULL DEFAULT 0,
    data           JSONB       NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    view_count     INT         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shared_networks_created
    ON shared_networks (created_at DESC);
