import { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { auth } from "../auth.js";

export async function systemRoutes(app: FastifyInstance) {
  app.addHook("onRequest", auth);
  app.get("/status", async () => {
    const c = await db.query("select count(*) filter (where status='live') l, count(*) t from connectors");
    const a = await db.query("select count(*) filter (where status='live') l, count(*) t from agents");
    return { systems: `${c.rows[0].l}/${c.rows[0].t} live`,
             agents: `${a.rows[0].l}/${a.rows[0].t} live`, version: "v3-operator" };
  });
}
