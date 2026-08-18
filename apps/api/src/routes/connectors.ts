import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { auth } from "../auth.js";
import { runProbe, runAllProbes, CONNECTOR_PROBES } from "../connectors/index.js";

export async function connectorRoutes(app: FastifyInstance) {
  app.addHook("onRequest", auth);

  app.get("/", async () => {
    const rows = (await db.query(
      `select slug, name, kind, status, latency_ms, last_sync_at, health from connectors order by name`)).rows;
    return { connectors: rows, probed: Object.keys(CONNECTOR_PROBES).length, total: rows.length };
  });

  app.post<{ Params: { slug: string } }>("/:slug/check", async (req, reply) => {
    if (!CONNECTOR_PROBES[req.params.slug]) return reply.code(404).send({ error: "no probe for this connector" });
    return runProbe(req.params.slug);
  });

  app.post("/check-all", async () => runAllProbes());
}
