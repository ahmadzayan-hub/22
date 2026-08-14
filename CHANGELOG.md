# Changelog

## 2026-08-14 — M3: agent runtime
- **Vault loader** (`runtime/vault.ts`): parses AGENT CONTRACT frontmatter +
  sections, syncs identities → `agents` (vault owns identity fields, DB keeps
  runtime status so approvals survive re-sync). `POST /agents/sync`.
- **Runner** (`runtime/runner.ts`): identity + top-k pgvector context → local
  LLM (JSON plan) → tasks/approvals → output markdown to
  `crews/<crew>/notes/` → `agent_runs` row (success/fail powers run-success %).
  Disabled agents only run with `trigger=shadow`.
- **Scheduler** (`runtime/scheduler.ts`): BullMQ repeatable job per
  `schedule_cron` + the 07:00 Conductor standup; Redis down degrades
  gracefully instead of killing the API.
- **tmux crews** (`runtime/tmux.ts`): one `os-<crew>` session per crew;
  list/ensure/restart; tmux added to the api image.
- **Conductor** (`runtime/conductor.ts`): daily standup (failures, stalled
  deals, overdue tasks, comms unread>24h → ≤3 tasks/crew + 10-line banner into
  `kpi_daily`, standup note in `notes/standups/`), operator chat, `broadcast`,
  `openclaw` (ad-hoc shadow sub-agent, one immediate run, never live without
  approval). Deterministic fallbacks when the local LLM is unreachable.
- Routes: `/api/v1/agents/*`, `/api/v1/conductor/*` (chat, broadcast, spawn,
  standup, tmux, runs). Enable-to-live gated on an `agent_enable` approval.
- Whole API typechecks clean under strict TS; `scripts/smoke/m3.sh` is the gate.

## 2026-08-14 — Design system + M1/M2 integration
- **Design:** 10 hi-fi mockups as real HTML/SVG (`design/mockups/`), rendered to
  3360×1890 PNGs: G-Brain, Org Chart, Dashboard, Sales sub-graph, Comms, Funnel,
  Workflows, Connections, Personas, hero shot. Single token sheet (`base.css`),
  JetBrains Mono embedded, dept palette validated on the dark surface
  (TECH shifted to #D05CFF for CVD separation from Comms blue; every dept color
  always ships with a text label).
- **Copy fixes vs AI reference renders:** "Furlesen"→removed, "Enganed"→Engaged,
  "WhatsAmp"→WhatsApp, "Ravb"→PAVA, "Savc"→Slack, "qwan3.6"→qwen3.6-hermes;
  funnel corrected to a monotonic cascade 34→28→20→15→7 (derived from the
  journeys seed; the reference's 34/34/26/30/7 was a render artifact).
- **Schema v3** (Operator deliverable) adopted at `schema.sql` with fixes:
  `uuid pk`→`uuid primary key`; dept seed colors aligned to design tokens.
- **Seed:** `scripts/generate_vault_and_seed.py` (fixed: f-string quoting,
  `'a'||b` Python concat, `s.title` call, conductor insert) → 35 vault
  identities + `seed.sql` (114 nodes, 22 connectors 18 live, dashboard KPIs).
- **M1 skeleton:** docker-compose (pgvector, redis, ollama, whisper profile,
  api, web), Fastify API with operator bearer auth + `/system/status`,
  Next.js shell with exact S4 sidebar.
- **M2 G-Brain:** ingest pipeline (text/voice/upload → markdown vault → chunk
  → bge-m3 embed → graph edges), `/gbrain/{graph,subgraph,search,stats}`,
  radial web page. Fixes vs draft: `embeddings.note_id` join in search,
  `db` extracted to `db.ts` (no route↔bootstrap circular import), LLM
  classifier falls back to keywords when Ollama is down.

## 2026-08-13 — Pre-M1 planning
- Repo tree, initial schema draft, API contract, milestone checklist, env vars
  (`docs/PLAN.md`). Superseded where noted by schema v3.
