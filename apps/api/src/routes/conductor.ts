import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { auth } from "../auth.js";
import { chat, broadcast, openclaw, runStandup } from "../runtime/conductor.js";
import { listSessions, ensureSessions, restartCrew } from "../runtime/tmux.js";

export async function conductorRoutes(app: FastifyInstance) {
  app.addHook("onRequest", auth);

  app.post("/chat", async (req) => chat(String((req.body as any)?.message ?? "")));
  app.post("/broadcast", async (req) => broadcast(String((req.body as any)?.message ?? "")));
  app.post("/spawn", async (req) => openclaw(String((req.body as any)?.mission ?? "")));
  app.post("/standup", async () => runStandup());
  app.get("/standup/latest", async () => {
    const row = (await db.query(
      `select day, snapshot->'banner' banner from kpi_daily order by day desc limit 1`)).rows[0];
    return row ?? { day: null, banner: [] };
  });

  app.get("/tmux", async () => listSessions());
  app.post("/tmux/ensure", async () => ensureSessions());
  app.post("/tmux/:crew/restart", async (req) => restartCrew((req.params as any).crew));

  app.get("/runs", async (req) => {
    const { agent, limit = 50 } = (req.query ?? {}) as any;
    return { runs: (await db.query(
      `select r.id, a.slug, r.started_at, r.finished_at, r.success, r.error
       from agent_runs r join agents a on a.id=r.agent_id
       where ($1::text is null or a.slug=$1)
       order by r.started_at desc limit $2`, [agent ?? null, Math.min(+limit, 200)])).rows };
  });
}
