# Changelog

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
