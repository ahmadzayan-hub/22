-- =====================================================================
-- ALKAHTANI OS · core schema · gate: psql -f schema.sql succeeds
-- Embedding dim 1024 (bge-m3). Change vector dims if model differs.
-- (v3 — Operator deliverable A, applied with syntax fixes: `uuid pk`
--  → `uuid primary key`; dept colors aligned to the validated design
--  tokens so hubs never collide with tool-red / note-yellow in S1.)
-- =====================================================================
create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------- enums ----------------
create type node_type      as enum ('dept','agent','tool','note','doc');
create type edge_kind      as enum ('belongs_to','uses','references','reports_to','feeds');
create type agent_status   as enum ('disabled','shadow','live','degraded');
create type task_state     as enum ('open','doing','done','blocked');
create type channel        as enum ('gmail','whatsapp','slack');
create type conn_status    as enum ('live','degraded','offline');
create type approval_kind  as enum ('agent_enable','rule_change','destructive_action','reply_send');
create type approval_state as enum ('pending','approved','rejected');
create type journey_stage  as enum ('first_touch','engaged','nurtured','opted_in','converted');
create type triage_state   as enum ('auto','needs_approval','approved','edited','sent');

-- ---------------- org ----------------
create table operators (
  id uuid primary key default gen_random_uuid(),
  name text not null, handle text unique not null,
  auth_secret text not null, created_at timestamptz default now());

create table departments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, label text not null,
  color text not null, icon text, sort int default 0);

-- ---------------- G-BRAIN graph ----------------
create table nodes (
  id uuid primary key default gen_random_uuid(),
  type node_type not null, label text not null,
  color text, dept_id uuid references departments(id),
  meta jsonb default '{}', created_at timestamptz default now(),
  updated_at timestamptz default now());

create table edges (
  id uuid primary key default gen_random_uuid(),
  src uuid not null references nodes(id) on delete cascade,
  dst uuid not null references nodes(id) on delete cascade,
  kind edge_kind not null, weight real default 1,
  meta jsonb default '{}', unique (src,dst,kind));

create table note_bodies (           -- markdown vault mirror (git is source of truth)
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references nodes(id) on delete cascade,
  vault_path text not null, body_md text not null,
  frontmatter jsonb default '{}',
  source_type text check (source_type in ('text','voice','upload','agent')),
  created_by text, created_at timestamptz default now());

create table embeddings (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references note_bodies(id) on delete cascade,
  chunk_idx int not null, chunk_text text not null,
  embedding vector(1024) not null);

-- ---------------- agents & runtime ----------------
create table agents (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null,
  dept_id uuid references departments(id),
  role text, model text not null default 'grok-4',
  identity_path text not null,          -- /vault/agents/<slug>.md
  schedule_cron text, tools text[] default '{}', permissions text[] default '{}',
  status agent_status default 'disabled', version int default 1,
  created_at timestamptz default now());

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  trace_id uuid, started_at timestamptz default now(), finished_at timestamptz,
  success boolean, error text,
  context jsonb default '{}', output_md text,
  tokens_in int default 0, tokens_out int default 0, cost_usd numeric(8,4) default 0);

-- ---------------- work management ----------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text,
  dept_id uuid references departments(id),
  state task_state default 'open', priority int default 2,
  assignee uuid references agents(id), created_by text,
  due_at timestamptz, completed_at timestamptz);

create table deals (
  id uuid primary key default gen_random_uuid(),
  title text not null, value_usd numeric(10,2), stage text,
  stalled boolean default false, owner uuid references agents(id),
  meta jsonb default '{}', updated_at timestamptz default now());

create table journeys (
  id uuid primary key default gen_random_uuid(),
  contact text, campaign text,
  stage journey_stage default 'first_touch',
  entered_at timestamptz default now(), converted_at timestamptz);

-- ---------------- comms ----------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  channel channel not null, external_id text,
  direction text check (direction in ('in','out')) default 'in',
  counterpart text, subject text, body text,
  summary text, draft_reply text,
  handled_by uuid references agents(id),
  triage triage_state default 'auto',
  received_at timestamptz default now(), sent_at timestamptz);

-- ---------------- system ----------------
create table connectors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null, kind text default 'mcp',
  status conn_status default 'offline',
  latency_ms int, last_sync_at timestamptz, env_key_ref text,
  health jsonb default '{}');

create table workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null, definition jsonb not null,   -- {triggers[],agents[],actions[],edges[]}
  enabled boolean default true, created_at timestamptz default now());

create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references workflows(id) on delete cascade,
  started_at timestamptz default now(), finished_at timestamptz,
  success boolean, log jsonb default '[]');

create table personas (
  id uuid primary key default gen_random_uuid(),
  name text not null, model text default 'grok-4',
  tone text[] default '{}', channels text[] default '{}',
  enabled boolean default false, prompt_md text);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  kind approval_kind not null, requested_by uuid references agents(id),
  payload jsonb not null, state approval_state default 'pending',
  decided_by text, decided_at timestamptz, created_at timestamptz default now());

create table incidents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id), connector_id uuid references connectors(id),
  severity int default 2, message text,
  resolved boolean default false, created_at timestamptz default now());

create table kpi_daily (
  day date primary key, snapshot jsonb not null);  -- nightly Conductor rollup

-- ---------------- indexes ----------------
create index on edges (src); create index on edges (dst);
create index on nodes (type); create index on note_bodies (node_id);
create index on embeddings using hnsw (embedding vector_cosine_ops);
create index on agent_runs (agent_id, started_at desc);
create index on tasks (state); create index on messages (channel, received_at desc);
create index on connectors (status);

-- ---------------- graph payload view (frontend S1) ----------------
create view v_graph as
select n.id, n.type, n.label, n.color, d.slug dept,
       coalesce(json_agg(json_build_object('dst',e.dst,'kind',e.kind))
         filter (where e.id is not null),'[]') out_edges
from nodes n left join departments d on d.id=n.dept_id
left join edges e on e.src=n.id group by n.id,d.slug;

-- ---------------- seed: six crews (validated design-token colors) ----------------
insert into departments (slug,label,color,sort) values
 ('sales','Sales','#FF7A2F',1), ('finances','Finances','#2EE06E',2),
 ('clients','Clients','#22D3EE',3), ('marketing','Marketing/Growth','#A3E635',4),
 ('tech','TECH','#D05CFF',5), ('communications','Communications','#3F8CFF',6);
