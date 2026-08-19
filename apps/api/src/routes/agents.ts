import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { auth } from "../auth.js";
import { runAgent } from "../runtime/runner.js";
import { identityFor, syncVault } from "../runtime/vault.js";

export async function agentRoutes(app: FastifyInstance) {
  app.addHook("onRequest", auth);

  app.get("/", async () => ({
    agents: (await db.query(
      `select a.slug, a.name, coalesce(d.slug,'-') crew, a.role, a.model, a.status,
              a.schedule_cron, a.tools,
              (select max(started_at) from agent_runs r where r.agent_id=a.id) last_run,
              (select bool_and(success) from agent_runs r where r.agent_id=a.id
                 and r.started_at > now() - interval '24 hours') day_green
       from agents a left join departments d on d.id=a.dept_id
       order by crew, a.slug`)).rows,
  }));

  app.get("/:slug", async (req) => {
    const { slug } = req.params as any;
    const a = (await db.query(`select * from agents where slug=$1`, [slug])).rows[0];
    if (!a) throw { statusCode: 404, error: "unknown agent" };
    const runs = (await db.query(
      `select id, started_at, finished_at, success, error from agent_runs
       where agent_id=$1 order by started_at desc limit 20`, [a.id])).rows;
    return { agent: a, identity_md: identityFor(slug)?.raw ?? null, runs };
  });

  app.post("/:slug/run", async (req) => {
    const { slug } = req.params as any;
    const { trigger = "operator", context = "" } = (req.body ?? {}) as any;
    return runAgent(slug, trigger, context);
  });

  // enable requires an agent_enable approval row — the Operator gate
  app.patch("/:slug", async (req) => {
    const { slug } = req.params as any;
    const { status } = (req.body ?? {}) as any;
    if (!["disabled", "shadow", "live", "degraded"].includes(status))
      throw { statusCode: 422, error: "bad status" };
    const a = (await db.query(`select id,status from agents where slug=$1`, [slug])).rows[0];
    if (!a) throw { statusCode: 404, error: "unknown agent" };
    if (status === "live" && a.status !== "live") {
      const approved = (await db.query(
        `select 1 from approvals where kind='agent_enable' and state='approved'
           and payload->>'agent' = $1 limit 1`, [slug])).rows[0];
      if (!approved) {
        await db.query(
          `insert into approvals (kind,requested_by,payload) values ('agent_enable',$1,$2)`,
          [a.id, JSON.stringify({ agent: slug, requested_status: "live" })]);
        return { agent: slug, status: a.status, pending_approval: true };
      }
    }
    await db.query(`update agents set status=$2 where slug=$1`, [slug, status]);
    return { agent: slug, status };
  });

  app.post("/sync", async () => ({ synced: await syncVault() }));
}
