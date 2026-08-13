# ZAYAN OS — Build Plan (pre-coding deliverable, §8)

> Assumption log: `{{COMPANY_NAME}}` was not provided → defaulting to **ZAYAN**
> (rename anytime via `COMPANY_NAME` env var; all labels read it).
> Backend = **Node/Fastify** (one language across the monorepo).
> LLM = Ollama `qwen3-hermes` alias, embeddings = `nomic-embed-text` (768-dim),
> voice = whisper.cpp sidecar. Cloud fallback = Anthropic API, env-keyed, off by default.

## (a) Repo tree

```
zayan-os/
├── docker-compose.yml           # postgres(pgvector) + server + web + ollama(optional profile)
├── .env.example
├── schema.sql                   # canonical DDL (applied idempotently on boot)
├── README.md
├── CHANGELOG.md
├── package.json                 # pnpm workspaces
├── apps/
│   ├── web/                     # Next.js 14 + TS + Tailwind, JetBrains Mono
│   │   ├── app/
│   │   │   ├── layout.tsx       # sidebar shell + "n/N systems live" status
│   │   │   ├── page.tsx         # Home
│   │   │   ├── g-brain/         # S1: radial/neural force graph + ingest bar
│   │   │   ├── org-chart/       # S2: hierarchy + Conductor chat + side panels
│   │   │   ├── dashboard/       # S3: pipeline/funnel/workforce/task board
│   │   │   └── {comms,funnel,workflows,social,content,finances,
│   │   │        agents,tasks,skills,connections,roadmap,analytics,
│   │   │        reference-model,personas}/page.tsx
│   │   ├── components/
│   │   │   ├── graph/           # ForceGraph2D wrappers: radial + neural modes
│   │   │   ├── org/             # agent cards, crew columns, conductor panel
│   │   │   ├── dashboard/       # KPI cards, funnel bars, task board
│   │   │   └── ingest/          # text / voice-record / drag-drop bar
│   │   └── lib/                 # api client, ws client, theme tokens
│   └── server/                  # Fastify + TS — REST + WebSocket
│       ├── src/
│       │   ├── index.ts         # boot: migrate → vault sync → scheduler → listen
│       │   ├── auth.ts          # single-operator bearer token
│       │   ├── ws.ts            # event bus → /ws broadcast
│       │   ├── routes/          # graph, ingest, search, agents, runs, tasks,
│       │   │                    # deals, funnel, dashboard, messages, conductor,
│       │   │                    # connectors, health
│       │   ├── runtime/
│       │   │   ├── vault.ts     # identity loader/parser (frontmatter + sections)
│       │   │   ├── scheduler.ts # BullMQ cron per agents.schedule_cron
│       │   │   ├── runner.ts    # identity + top-k context → LLM → tools → run log
│       │   │   ├── conductor.ts # inbox → plan → delegate → collect loop
│       │   │   ├── tmux.ts      # one session per crew; inspect/restart
│       │   │   └── approval.ts  # paid/destructive gate → approval task
│       │   ├── llm/             # ollama client, cloud fallback, JSON-schema outputs
│       │   ├── brain/           # md writer, chunker, embedder, pgvector search
│       │   ├── mcp/             # connector modules, each with health():
│       │   │   └── {attio,hubspot,stripe,paypal,square,slack,gmail,
│       │   │        whatsapp,manychat,notion,calendar}.ts
│       │   └── db/              # pool, migrate, typed queries
│       └── test/                # vitest smoke suites per milestone
├── vault/                       # git-versioned markdown = source of truth
│   ├── agents/{sales,finances,clients,marketing,tech,comms}/<id>.md
│   ├── agents/conductor.md
│   ├── notes/{standups,weekly,inbox}/
│   └── docs/
├── scripts/
│   ├── seed.ts                  # 31 agents + 100+ nodes + demo deals/tasks/msgs
│   ├── backup.sh                # pg_dump + vault tarball
│   └── smoke/m1.sh … m6.sh
└── docs/{PLAN.md,API.md}
```

## (b) schema.sql

Shipped at repo root: [`schema.sql`](../schema.sql). Tables: `nodes, edges,
agents, runs, tasks, deals, journeys, messages, kpi_daily, chunks(vector 768,
HNSW)` + `updated_at` triggers. Matches §3 with pragmatic additions:
`tasks.kind='approval'` (Operator gate), `messages.handled_at` (unread>24h),
`runs.trigger`, `hub` node type for the Notes/Nexus hub.

## (c) API contract

All REST under `/api`, bearer `OPERATOR_TOKEN`. WS at `/ws` (same token via query).

| Method | Path | Purpose | Returns |
|---|---|---|---|
| POST | `/api/auth/login` | operator password → token | `{token}` |
| GET | `/api/health` | app+db+ollama liveness | `{ok, systems:{name:bool}}` |
| GET | `/api/graph?focus=<dept>` | nodes+edges (focus expands dept→tools→agents→notes) | `{nodes[], edges[]}` |
| POST | `/api/ingest/text` | `{text}` → classify dept → md note → chunks+embeds+edges | `{node}` |
| POST | `/api/ingest/upload` | multipart file(s) → markdown → same pipeline | `{nodes[]}` |
| POST | `/api/ingest/voice` | audio blob → whisper transcript → same pipeline | `{node, transcript}` |
| GET | `/api/search?q=&k=8` | pgvector top-k over chunks | `{hits:[{node_id,content,score}]}` |
| GET | `/api/agents` | roster incl. crew, model, status, last-run | `{agents[]}` |
| GET | `/api/agents/:id` | identity md + recent runs | `{agent, identity_md, runs[]}` |
| POST | `/api/agents` | draft new agent (DISABLED + shadow-test plan) | `{agent, approval_task}` |
| PATCH | `/api/agents/:id` | enable/disable/status change | `{agent}` |
| POST | `/api/agents/:id/run` | manual trigger | `{run_id}` |
| GET | `/api/runs?agent_id=&since=` | run log | `{runs[]}` |
| GET | `/api/tasks?state=&crew=` | board | `{tasks[], counts}` |
| POST | `/api/tasks` / PATCH `/api/tasks/:id` | create / move state | `{task}` |
| GET | `/api/deals?stage=` | pipeline incl. stalled flags | `{deals[], totals}` |
| GET | `/api/funnel` | journey stage counts + % | `{stages[]}` |
| GET | `/api/dashboard` | S3 aggregate: pipeline, closed-won, monthly, workforce, run-success | `{cards}` |
| GET | `/api/messages?unhandled=1` | unified comms feed | `{messages[]}` |
| POST | `/api/conductor/chat` | operator ↔ Conductor (SSE stream) | stream + `{actions[]}` |
| POST | `/api/conductor/broadcast` | `{message}` → all crew bosses | `{delivered[]}` |
| POST | `/api/conductor/openclaw` | `{mission}` → spawn ad-hoc sub-agent | `{agent_id, run_id}` |
| GET | `/api/conductor/tmux` | crew session states | `{sessions[]}` |
| POST | `/api/conductor/tmux/:crew/restart` | restart a crew session | `{ok}` |
| GET | `/api/connectors` | MCP connector health badges | `{connectors:[{name,ok,latency}]}` |
| WS | `/ws` | push events | `run.started/finished`, `task.updated`, `node.created`, `message.received`, `workforce.tick`, `banner.updated` |

## (d) Milestone checklist

Every milestone gates the next: `docker compose up -d --build` green,
smoke script exits 0, README + CHANGELOG updated, one commit.

- [ ] **M1 Skeleton** — monorepo, docker, operator auth, sidebar nav shell (§ S4 exact labels), terminal-brutalist theme.
      Test: `bash scripts/smoke/m1.sh` → health 200, login works, all 19 sidebar routes render.
- [ ] **M2 G-Brain** — ingest pipeline (text/voice/upload → md → chunk → embed), graph API, radial view + dept expansion.
      Test: `bash scripts/smoke/m2.sh` → ingest text, search returns it, `/api/graph` ≥ 7 hubs, expansion order Tools→Agents→Notes.
- [ ] **M3 Runtime** — vault loader, BullMQ scheduler, run logger, tmux crews, Conductor loop + chat.
      Test: `bash scripts/smoke/m3.sh` → manual run logs success row, chat round-trip, tmux lists 6 sessions.
- [ ] **M4 Crews + MCP** — 11 connector modules w/ health checks, seed roster of §5 (31 agents).
      Test: `bash scripts/smoke/m4.sh` → `/api/connectors` lists all w/ status, `/api/agents` count ≥ 31, each has identity file.
- [ ] **M5 Dashboard** — pipeline/funnel/workforce/task-board APIs + UI, fed from runs/tasks/deals.
      Test: `bash scripts/smoke/m5.sh` → `/api/dashboard` numbers reconcile with raw tables; funnel %s sum sane.
- [ ] **M6 Hardening** — failure alerts, nightly Conductor self-report → `kpi_daily`, `backup.sh`, full seed (100+ nodes), docs.
      Test: `bash scripts/smoke/m6.sh` → seed idempotent, backup produces artifacts, forced-failure run raises alert task.

## (e) Environment variables

| Var | Default | Purpose |
|---|---|---|
| `COMPANY_NAME` | `ZAYAN` | brand label everywhere |
| `DATABASE_URL` | `postgres://zayan:zayan@postgres:5432/zayan_os` | pgvector Postgres |
| `POSTGRES_PASSWORD` | `zayan` (dev only) | compose-injected |
| `REDIS_URL` | `redis://redis:6379` | BullMQ scheduler |
| `OPERATOR_PASSWORD` | — (required) | single-operator login |
| `OPERATOR_TOKEN_SECRET` | — (required) | signs session tokens |
| `API_PORT` / `WEB_PORT` | `4000` / `3000` | service ports |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | local LLM |
| `OLLAMA_MODEL` | `qwen3-hermes` | Conductor/agent default model |
| `EMBED_MODEL` / `EMBED_DIM` | `nomic-embed-text` / `768` | must match `chunks.embedding` |
| `ANTHROPIC_API_KEY` | empty = disabled | optional cloud fallback |
| `WHISPER_URL` | `http://whisper:8080` | voice transcription sidecar |
| `VAULT_PATH` | `./vault` | markdown source of truth |
| `APPROVALS_REQUIRED` | `true` | paid/destructive actions gate |
| `ATTIO_API_KEY`, `HUBSPOT_TOKEN` | empty | CRM connectors |
| `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `SQUARE_ACCESS_TOKEN` | empty | payments |
| `SLACK_BOT_TOKEN` | empty | Slack |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | empty | Gmail + Calendar |
| `WHATSAPP_TOKEN`, `MANYCHAT_API_KEY` | empty | WhatsApp/ManyChat |
| `NOTION_TOKEN` | empty | Notion |
| `BACKUP_DIR` | `./backups` | M6 backups |

Empty connector key ⇒ module reports `status: unconfigured` (amber badge), never crashes.
