# ZAYAN OS

An Agentic Operating System: one human Operator, one CONDUCTOR super-agent,
6 crews, ~35 AI agents, a pgvector-backed G-BRAIN knowledge core, and a live
business dashboard — dark terminal-brutalist UI throughout.

**Status: pre-M1.** Planning deliverables are in place; implementation starts
on "PROCEED M1".

- [`docs/PLAN.md`](docs/PLAN.md) — repo tree, API contract, milestone checklist, env vars
- [`schema.sql`](schema.sql) — canonical data model (Postgres + pgvector)

## Milestones

| # | Scope | Status |
|---|---|---|
| M1 | Skeleton: monorepo, docker, operator auth, nav shell, theme | pending |
| M2 | G-Brain: ingest → embed pipeline, graph API, radial view | pending |
| M3 | Runtime: vault loader, scheduler, run log, tmux crews, Conductor | pending |
| M4 | Crews + MCP connectors + seed roster | pending |
| M5 | Dashboard / funnel / task board | pending |
| M6 | Hardening: alerts, self-report, backups, seed, docs | pending |
