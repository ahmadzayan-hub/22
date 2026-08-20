import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { auth } from "../auth.js";

export async function alertRoutes(app: FastifyInstance) {
  app.addHook("onRequest", auth);

  app.get("/", async (req) => {
    const { resolved = "false", limit = "50" } = req.query as { resolved?: string; limit?: string };
    const rows = (await db.query(
      `select i.id, i.severity, i.message, i.resolved, i.created_at,
              a.slug agent_slug, c.slug connector_slug
       from incidents i left join agents a on a.id=i.agent_id
                         left join connectors c on c.id=i.connector_id
       where ($1::text = 'all' or i.resolved = $1::boolean)
       order by i.created_at desc limit $2`,
      [resolved, Math.min(Number(limit) || 50, 200)])).rows;
    return { incidents: rows, open: rows.filter((r: any) => !r.resolved).length };
  });

  app.patch<{ Params: { id: string } }>("/:id/resolve", async (req) => {
    await db.query(`update incidents set resolved=true where id=$1`, [req.params.id]);
    return { id: req.params.id, resolved: true };
  });
}
