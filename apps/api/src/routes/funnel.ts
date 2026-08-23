import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { auth } from "../auth.js";

const STAGE_ORDER = ["first_touch", "engaged", "nurtured", "opted_in", "converted"] as const;

export async function funnelRoutes(app: FastifyInstance) {
  app.addHook("onRequest", auth);

  app.get("/", async () => {
    const rows = (await db.query(`select stage, count(*) n from journeys group by stage`)).rows;
    const byStage: Record<string, number> = Object.fromEntries(rows.map((r: any) => [r.stage, Number(r.n)]));
    let prevReached: number | null = null;
    const stages = STAGE_ORDER.map((stage, i) => {
      const reached = STAGE_ORDER.slice(i).reduce((sum, s) => sum + (byStage[s] ?? 0), 0);
      const carry_pct = prevReached ? Math.round((reached / prevReached) * 100) : null;
      prevReached = reached;
      return { stage, count: reached, carry_pct };
    });
    return { total: stages[0]?.count ?? 0, stages };
  });

  app.get("/journeys", async (req) => {
    const { limit = "20" } = req.query as { limit?: string };
    const rows = (await db.query(
      `select id, contact, campaign, stage, entered_at, converted_at
       from journeys order by coalesce(converted_at, entered_at) desc limit $1`,
      [Math.min(Number(limit) || 20, 100)])).rows;
    return { journeys: rows };
  });
}
