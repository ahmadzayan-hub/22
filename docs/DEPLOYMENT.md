# Deployment Guide

## Current Architecture

### GitHub Pages (Static Frontend)
- **Status**: ✅ Live at `https://ahmadzayan-hub.github.io/22/`
- **What's deployed**: Next.js static export of the web frontend (Dashboard, Funnel, Tasks, G-Brain pages)
- **Build trigger**: Automatic on pushes to `main` branch
- **Workflow**: `.github/workflows/nextjs.yml`

### Local Development
- **Stack**: Docker Compose (PostgreSQL, Redis, Ollama, API, Web)
- **API**: Runs on `localhost:8080` in compose
- **Web**: Runs on `localhost:3000` in dev mode (server build, not static)
- **Database**: Auto-seeded on compose startup (schema.sql + seed.sql)

### Production (API)
- **Status**: ⏳ Not yet deployed
- **Where to host**: Any infrastructure that can run Node.js (Vercel, Railway, Fly.io, self-hosted, etc.)
- **Key requirement**: Must be publicly accessible so the GitHub Pages static site can fetch data

---

## GitHub Pages Workflow

### How It Works

The workflow (`.github/workflows/nextjs.yml`) does the following:

1. **Trigger**: Runs on pushes to `main` branch
2. **Build step**:
   - Checks out code
   - Sets `NEXT_BASE_PATH=/22` environment variable
   - Runs `npx next build` in `apps/web/`
   - Next.config.mjs sees `NEXT_BASE_PATH` and enables:
     - `output: "export"` (static HTML generation)
     - `basePath: "/22"` (GitHub Pages subpath)
     - `images.unoptimized: true` (no Image optimization)
3. **Deploy step**: Uploads `apps/web/out/` to GitHub Pages

### Configuration

**next.config.mjs** (apps/web/next.config.mjs):
```javascript
const nextConfig = process.env.NEXT_BASE_PATH
  ? { output: "export", basePath: process.env.NEXT_BASE_PATH, images: { unoptimized: true } }
  : {};
export default nextConfig;
```

This conditional configuration ensures:
- **Without NEXT_BASE_PATH**: Normal server build (used locally and in Docker)
- **With NEXT_BASE_PATH=/22**: Static export for GitHub Pages (used in workflow only)

### What's Deployed

The static site includes:
- `/` — Home page
- `/g-brain` — Knowledge search and graph visualization
- `/dashboard` — Pipeline, KPIs, workforce overview
- `/funnel` — Sales funnel cascade with journey counts
- `/tasks` — Task board with add box and column moves

### Current Limitation

The deployed static site **renders UI shells but cannot populate data** because:
- No `NEXT_PUBLIC_API` environment variable is set in the workflow
- The site cannot make requests to a live API
- Pages load but show empty states or placeholder data from the seeded snapshot

---

## API Deployment Strategy

### What Needs to Be Done

To make the full stack functional, the API must be:

1. **Deployed** to a public URL
2. **Accessible** from the GitHub Pages static site (CORS configured)
3. **Database** backed by a production PostgreSQL (not local)
4. **Configured** with environment variables (auth, LLM provider, etc.)

### Recommended Platforms

**Easiest (Git-connected, auto-deploy):**
- **Vercel**: Native Node.js support, auto-deploys from main, free tier available
- **Railway**: Postgres + Node.js on same platform, minimal config
- **Fly.io**: Global deployment, generous free tier

**Self-hosted (full control):**
- **AWS**: ECS/Fargate for API, RDS for database
- **Google Cloud**: Cloud Run for API, Cloud SQL for database
- **Azure**: App Service + Database
- **DigitalOcean/Linode**: App Platform or VPS with Docker

### Setup Steps

1. **Choose hosting platform**

2. **Set up PostgreSQL database**
   - Run `schema.sql` to create tables and pgvector extension
   - Run `seed.sql` to populate demo data
   - Note: embeddings (bge-m3) require pgvector

3. **Configure environment variables** (at minimum):
   ```
   DATABASE_URL=postgresql://user:pass@host/dbname
   OPERATOR_TOKEN=your-secure-token
   XAI_API_KEY=your-grok-api-key (or leave unset for Ollama fallback)
   ALERT_WEBHOOK_URL=optional-slack-webhook
   ```

4. **Deploy the API** (`apps/api/`)
   - Most platforms support `npm ci && npm start` or similar
   - Expose port 8080 (or adjust in `apps/api/src/index.ts`)

5. **Configure GitHub Pages to call the API**
   - Set `NEXT_PUBLIC_API` in the workflow to your API's public URL
   - Example: `NEXT_PUBLIC_API=https://api.example.com`
   - Redeploy the site (push to main)

6. **Verify CORS on API**
   - API should allow requests from `https://ahmadzayan-hub.github.io`
   - Check `apps/api/src/index.ts` for CORS configuration

### Database Considerations

- **pgvector extension**: Required for embeddings (G-Brain search)
  - All managed PostgreSQL providers support this
  - Self-hosted: `CREATE EXTENSION IF NOT EXISTS vector;`

- **Size**: Current seed is ~114 nodes, very small
  - Free tier database easily handles this
  - No sharding or optimization needed for demo scale

- **Backups**: Use `scripts/backup_db.sh` on a cron job
  - Dumps to `$BACKUP_DIR`, prunes to `$BACKUP_RETAIN`
  - Deploy this to your hosting platform's scheduler

### API Features

The deployed API will include:

- **G-Brain**: Full-text + semantic search via pgvector embeddings
- **Dashboard**: Live pipeline data, KPIs, workforce status
- **Funnel**: Sales cascade with reached-stage counts
- **Tasks**: Board with real-time counts and state management
- **Agents**: Vault loading, runtime scheduling (M3+)
- **Connectors**: MCP health probes (M4)
- **Alerts**: Incident tracking and webhook notifications (M6)
- **Conductor**: Nightly standup reports, operator chat (M3+)

---

## Deployment Checklist

### Immediate (Already Done)
- [x] Fix GitHub Pages workflow for monorepo structure
- [x] Configure static export with basePath
- [x] Deploy frontend to GitHub Pages
- [x] Verify static site is live

### Next Steps
- [ ] Choose API hosting platform
- [ ] Provision PostgreSQL database
- [ ] Deploy `apps/api/` with environment variables
- [ ] Set `NEXT_PUBLIC_API` in GitHub Pages workflow
- [ ] Verify API is callable from GitHub Pages
- [ ] Test dashboard/funnel/tasks with live data
- [ ] Set up database backups
- [ ] Configure monitoring and alerts

### Optional (Post-MVP)
- [ ] Custom domain instead of GitHub Pages subpath
- [ ] Setup CI/CD for API (auto-deploy on main)
- [ ] Add authentication UI for Operator login
- [ ] Deploy all M3+ features (agents, scheduler, Conductor)

---

## Local Development Reference

To test the full stack locally:

```bash
# Start infrastructure
docker compose up -d --build

# Ensure embeddings model is available
docker compose exec ollama ollama pull bge-m3
docker compose exec ollama ollama pull qwen3:8b  # optional fallback LLM

# Run smoke tests
bash scripts/smoke/m3.sh
bash scripts/smoke/m4.sh
bash scripts/smoke/m5.sh
bash scripts/smoke/m6.sh

# Test web frontend (server build)
cd apps/web && npm run dev

# Open http://localhost:3000
```

---

## Troubleshooting

### Static site shows empty dashboards
→ `NEXT_PUBLIC_API` is not set, or API is unreachable
→ Check browser console for CORS errors
→ Verify API URL and that it's accessible from GitHub Pages

### Workflow fails to build
→ Check that `apps/web/` exists and has `package.json`, `next.config.mjs`
→ Verify `NEXT_BASE_PATH=/22` is set in workflow
→ Look at workflow run logs for specific error

### API container exits
→ Check `DATABASE_URL` is correct and database is running
→ Verify `OPERATOR_TOKEN` is set (non-empty string is fine)
→ Check `apps/api/src/index.ts` for startup errors

### Embeddings not working
→ Ensure pgvector extension is installed in PostgreSQL
→ Verify `bge-m3` model is pulled in Ollama
→ Check `apps/api/src/services/llm.ts` for LLM configuration
