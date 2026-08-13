-- ============================================================
-- ZAYAN OS — Agentic Operating System schema
-- Postgres 16 + pgvector
-- Applied by: apps/server/src/db/migrate.ts (idempotent)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Graph: everything G-BRAIN renders is a node or an edge.
-- node id convention: "<type>:<slug>" e.g. "dept:sales",
-- "agent:attio-crm", "tool:stripe", "note:2026-08-13-standup"
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodes (
  id         text PRIMARY KEY,
  type       text NOT NULL CHECK (type IN ('dept','agent','tool','note','doc','hub')),
  label      text NOT NULL,
  color      text NOT NULL DEFAULT '#e5e5e5',
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nodes_type_idx ON nodes(type);

CREATE TABLE IF NOT EXISTS edges (
  src  text NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  dst  text NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'link',          -- link|member|uses|mentions|derived
  PRIMARY KEY (src, dst, kind)
);
CREATE INDEX IF NOT EXISTS edges_dst_idx ON edges(dst);

-- ------------------------------------------------------------
-- Agents: DB row mirrors the vault identity file (source of
-- truth is vault/agents/<crew>/<id>.md; loader syncs on boot).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  id            text PRIMARY KEY,             -- slug, matches identity frontmatter
  crew          text NOT NULL CHECK (crew IN
                  ('sales','finances','clients','marketing','tech','comms','conductor')),
  role          text NOT NULL,                -- one-line role shown on org card
  model         text NOT NULL,                -- e.g. qwen3-hermes
  schedule_cron text,                         -- NULL = on-demand only
  tools         text[] NOT NULL DEFAULT '{}',
  identity_path text NOT NULL,                -- vault-relative path to .md identity
  status        text NOT NULL DEFAULT 'disabled'
                  CHECK (status IN ('enabled','disabled','shadow')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agents_crew_idx ON agents(crew);

-- Every execution, scheduled or ad-hoc; powers "run success %".
CREATE TABLE IF NOT EXISTS runs (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id  text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  started   timestamptz NOT NULL DEFAULT now(),
  finished  timestamptz,
  success   boolean,                          -- NULL while running
  output_md text,
  error     text,
  trigger   text NOT NULL DEFAULT 'schedule'  -- schedule|conductor|operator|shadow
);
CREATE INDEX IF NOT EXISTS runs_agent_started_idx ON runs(agent_id, started DESC);
CREATE INDEX IF NOT EXISTS runs_started_idx ON runs(started DESC);

-- ------------------------------------------------------------
-- Work & business state
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  crew       text NOT NULL,
  state      text NOT NULL DEFAULT 'open' CHECK (state IN ('open','doing','done')),
  assignee   text REFERENCES agents(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'work',    -- work|approval  (approval = Operator gate)
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  due_at     timestamptz
);
CREATE INDEX IF NOT EXISTS tasks_state_idx ON tasks(state);
CREATE INDEX IF NOT EXISTS tasks_crew_idx  ON tasks(crew);

CREATE TABLE IF NOT EXISTS deals (
  id         text PRIMARY KEY,                -- CRM id or local slug
  name       text NOT NULL DEFAULT '',
  stage      text NOT NULL CHECK (stage IN
               ('open','qualified','proposal','won','lost')),
  value      numeric(14,2) NOT NULL DEFAULT 0,
  stalled    boolean NOT NULL DEFAULT false,
  closed_at  timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(stage);

-- One row per contact moving through the funnel.
CREATE TABLE IF NOT EXISTS journeys (
  id         text PRIMARY KEY,
  stage      text NOT NULL CHECK (stage IN
               ('first_touch','engaged','nurtured','opted_in','converted')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journeys_stage_idx ON journeys(stage);

CREATE TABLE IF NOT EXISTS messages (
  id          text PRIMARY KEY,               -- provider message id
  channel     text NOT NULL CHECK (channel IN ('gmail','whatsapp','slack')),
  direction   text NOT NULL CHECK (direction IN ('in','out')),
  summary     text NOT NULL,
  handled_by  text REFERENCES agents(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  handled_at  timestamptz                     -- NULL = unread; powers "unread > 24h"
);
CREATE INDEX IF NOT EXISTS messages_unhandled_idx
  ON messages(received_at) WHERE handled_at IS NULL;

-- Nightly KPI snapshot written by the Conductor self-report.
CREATE TABLE IF NOT EXISTS kpi_daily (
  date     date PRIMARY KEY,
  snapshot jsonb NOT NULL
);

-- ------------------------------------------------------------
-- G-BRAIN embeddings: notes/docs are chunked and embedded.
-- Dim 768 matches nomic-embed-text (EMBED_DIM env must agree).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id     text NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  chunk_index int  NOT NULL,
  content     text NOT NULL,
  embedding   vector(768),
  UNIQUE (node_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nodes','agents','tasks','deals','journeys'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I_touch ON %I;
       CREATE TRIGGER %I_touch BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION touch_updated_at();', t, t, t, t);
  END LOOP;
END $$;
