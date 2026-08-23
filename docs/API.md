# ALKAHTANI OS — API Contract (`/api/v1`, bearer auth)

`Authorization: Bearer $OPERATOR_TOKEN` on every route below except `GET /health`.
No WebSocket transport exists yet — pages poll REST on mount (see `apps/web/app/*/page.tsx`).

## Implemented (M1–M6)

| Module | Method + Path | Purpose |
|---|---|---|
| System | `GET /health` | liveness, no auth |
| | `GET /system/status` | connector/agent live counts + active LLM provider |
| G-Brain | `POST /gbrain/ingest` | text / voice / upload → md + embed + graph edges |
| | `GET /gbrain/graph?view=radial\|neural` | full graph payload (S1) |
| | `GET /gbrain/depts/{slug}/subgraph` | expanded crew view (S1.2) |
| | `POST /gbrain/search` `{query,k}` | hybrid vector + keyword search |
| | `GET /gbrain/stats` | node counts by type |
| Agents | `GET /agents` · `GET /agents/{slug}` | roster + status + last run / run history |
| | `POST /agents/{slug}/run` `{trigger,context}` | ad-hoc or shadow run |
| | `PATCH /agents/{slug}` `{status}` | disabled/shadow/live/degraded — live opens an `agent_enable` approval if not already approved |
| | `POST /agents/sync` | re-sync `agents` from `vault/agents/*.md` |
| Conductor | `POST /conductor/chat` `{message}` | operator chat, may create tasks |
| | `POST /conductor/broadcast` `{message}` | one inbox task per crew |
| | `POST /conductor/spawn` `{mission}` | openclaw ad-hoc shadow sub-agent |
| | `POST /conductor/standup` | run the daily standup now |
| | `GET /conductor/standup/latest` | most recent standup banner (from `kpi_daily`) |
| | `GET /conductor/runs?agent=&limit=` | agent_runs history |
| | `GET /conductor/tmux` · `POST /conductor/tmux/ensure` · `POST /conductor/tmux/{crew}/restart` | crew session supervision |
| Connectors | `GET /connectors` | registry + live status/latency/health |
| | `POST /connectors/{slug}/check` | probe one connector now |
| | `POST /connectors/check-all` | probe all 12 named connectors now |
| Dashboard | `GET /dashboard/summary` | pipeline, closed-won, MRR, funnel cascade, workforce, task counts (S3) |
| Funnel | `GET /funnel` | reached-stage cascade + carry % (S7) |
| | `GET /funnel/journeys?limit=` | active journeys, newest movement first |
| Tasks | `GET /tasks` | board + per-state counts |
| | `POST /tasks` `{title,body?,dept?,priority?,due_at?}` | create |
| | `PATCH /tasks/{id}` `{state}` | move between open/doing/done/blocked |
| Alerts | `GET /alerts?resolved=false\|true\|all&limit=` | incidents (agent-run failures, connector status drops) |
| | `PATCH /alerts/{id}/resolve` | mark an incident resolved |

## Planned, not yet built

Org chart (S2 is served from `/gbrain/graph` client-side), Comms inbox + approve/edit/reject
reply flow (S6), Workflows CRUD + run history (S8), Personas CRUD (S10), a general
`/approvals` list+decide endpoint (approvals are created inline by the routes above; there's
no listing/decision endpoint yet), and any WebSocket/live-push transport — today's pages
poll on mount and don't auto-refresh.
