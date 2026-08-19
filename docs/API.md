# ALKAHTANI OS — API Contract (`/api/v1`, bearer auth)

Agent→tool calls go via MCP, not REST. WS events at `/ws`.
Implemented so far: **Auth (token check), System, G-Brain** (M1–M2). The rest land with M3–M5.

| Module | Method + Path | Purpose | Caller |
|---|---|---|---|
| Auth | `POST /auth/login` · `GET /auth/me` | operator session | UI |
| G-Brain | `POST /gbrain/ingest` | text / voice / upload → md + embed + edges | UI+Agent |
| | `GET /gbrain/graph?view=radial\|neural` | full graph payload (S1) | UI |
| | `GET /gbrain/depts/{slug}/subgraph` | expanded crew view (S4) | UI |
| | `POST /gbrain/search` `{query,k,dept?}` | hybrid vector+keyword | UI+Agent |
| | `GET /gbrain/stats` | "114 NODES" counters | UI |
| Agents | `GET /agents` · `GET /agents/{id}` | roster + status + last run | UI |
| | `POST /agents` | create from identity md (status=disabled) | UI |
| | `GET/PUT /agents/{id}/identity` | raw markdown (PUT → `rule_change` approval if live) | UI |
| | `PATCH /agents/{id}/status` | enable needs `agent_enable` approval | UI |
| | `POST /agents/{id}/run` · `GET /agents/{id}/runs` | ad-hoc trigger / history | UI+Agent |
| Conductor | `POST /conductor/chat` | "reaches all agents" (streams over WS) | UI |
| | `POST /conductor/broadcast` · `POST /conductor/spawn` | broadcast / openclaw | Agent |
| | `GET /conductor/tmux` · `POST /conductor/tmux/{crew}/restart` | supervise / self-heal | Agent |
| Org | `GET /org/chart` · `GET /org/crews` | hierarchy tree (S2) | UI |
| Dashboard | `GET /dashboard/summary` · `/funnel` · `/workforce` · `/taskboard` | S3 cards | UI |
| Tasks | `GET/POST /tasks` · `PATCH/DELETE /tasks/{id}` | board CRUD | UI+Agent |
| Pipeline | `GET /deals?stalled=` · `PATCH /deals/{id}` · `GET /journeys` · `POST /journeys/{id}/advance` | funnel/deals | UI+Agent |
| Comms | `GET /comms/messages?channel=&state=` · `GET /comms/messages/{id}` | unified inbox | UI |
| | `POST .../approve` · `.../edit` · `.../reject` | human-in-the-loop reply flow | UI |
| | `GET /comms/stats` | "342 msgs – 98% auto-triaged" | UI |
| Connections | `GET /connectors` · `GET /connectors/summary` · `POST /connectors/{id}/probe` · `PATCH /connectors/{id}` | MCP registry + health (S9) | UI+Agent |
| Workflows | `GET/POST /workflows` · `POST /workflows/{id}/run` · `GET /workflows/{id}/runs` | automation canvas | UI |
| Personas | `GET/POST /personas` · `PATCH /personas/{id}` | variants + toggles | UI |
| Approvals | `GET /approvals?state=pending` · `POST /approvals/{id}/decide` | operator gate | UI |
| System | `GET /system/status` ("n/N live") · `GET /system/kpi` · `POST /system/backup` | ops | UI |

**WS `/ws` events:** `run.finished`, `agent.status_changed`, `connector.status_changed`,
`message.received`, `task.updated`, `approval.requested`, `conductor.stream`, `dashboard.tick`.
