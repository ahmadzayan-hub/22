import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { auth } from "../auth.js";

const STAGE_ORDER = ["first_touch", "engaged", "nurtured", "opted_in", "converted"] as const;

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("onRequest", auth);

  app.get("/summary", async () => {
    const [pipeline, closedWon, stalled, funnelRows, workforce, byDept, runsToday, kpi, taskCounts] =
      await Promise.all([
        db.query(`select coalesce(sum(value_usd),0) usd, count(*) n from deals
                   where stage not in ('closed_won','lost')`),
        db.query(`select coalesce(sum(value_usd),0) usd, count(*) n from deals where stage='closed_won'`),
        db.query(`select title, value_usd, extract(day from now()-updated_at)::int stall_days
                   from deals where stalled and stage not in ('closed_won','lost')
                   order by updated_at asc limit 1`),
        db.query(`select stage, count(*) n from journeys group by stage`),
        db.query(`select count(*) filter (where status='live') live, count(*) total from agents`),
        db.query(`select d.slug, d.label, d.color,
                          count(a.*) filter (where a.status='live') live, count(a.*) total
                   from departments d left join agents a on a.dept_id=d.id
                   group by d.id order by d.sort`),
        db.query(`select count(*) n, count(*) filter (where success) ok
                   from agent_runs where started_at::date = current_date`),
        db.query(`select snapshot from kpi_daily order by day desc limit 1`),
        db.query(`select state, count(*) n from tasks group by state`),
      ]);

    const stageCounts: Record<string, number> = Object.fromEntries(
      funnelRows.rows.map((r: any) => [r.stage, Number(r.n)]));
    const funnel = STAGE_ORDER.map((stage, i) => {
      const reached = STAGE_ORDER.slice(i).reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0);
      return { stage, count: reached };
    });
    const totalJourneys = funnel[0]?.count ?? 0;

    const runsTodayN = Number(runsToday.rows[0].n);
    const snapshot = kpi.rows[0]?.snapshot ?? {};
    const runSuccess = runsTodayN > 0
      ? Number(runsToday.rows[0].ok) / runsTodayN
      : (snapshot.run_success ?? null);
    const runsCount = runsTodayN > 0 ? runsTodayN : (snapshot.runs ?? 0);

    const taskCountMap: Record<string, number> = Object.fromEntries(
      taskCounts.rows.map((r: any) => [r.state, Number(r.n)]));

    return {
      pipeline: {
        open_usd: Number(pipeline.rows[0].usd), open_count: Number(pipeline.rows[0].n),
        stalled_oldest: stalled.rows[0] ?? null,
      },
      closed_won: { usd: Number(closedWon.rows[0].usd), count: Number(closedWon.rows[0].n) },
      monthly_usd: snapshot.monthly_usd ?? null,
      funnel: { total: totalJourneys, stages: funnel },
      workforce: {
        live: Number(workforce.rows[0].live), total: Number(workforce.rows[0].total),
        run_success: runSuccess, runs_today: runsCount,
        by_dept: byDept.rows.map((r: any) => ({
          slug: r.slug, label: r.label, color: r.color,
          live: Number(r.live), total: Number(r.total) })),
      },
      tasks: {
        open: taskCountMap.open ?? 0, doing: taskCountMap.doing ?? 0,
        done: taskCountMap.done ?? 0, blocked: taskCountMap.blocked ?? 0,
        total: taskCounts.rows.reduce((s: number, r: any) => s + Number(r.n), 0),
      },
    };
  });
}
