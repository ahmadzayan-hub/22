import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { db } from "../db.js";
import { auth } from "../auth.js";
import { ingest } from "../services/ingest.js";
import { embed } from "../services/ollama.js";

const RING: Record<string, number> = { dept: 1, note: 1.7, agent: 2.3, tool: 3 };
const polar = (r: number, a: number) => ({ x: +(r * Math.cos(a)).toFixed(3), y: +(r * Math.sin(a)).toFixed(3) });

export async function gbrainRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 25e6 } });
  app.addHook("onRequest", auth);

  app.post("/ingest", async (req) => {
    if (!(req.headers["content-type"] ?? "").includes("multipart"))
      return ingest({ text: (req.body as any)?.text });
    let text: string | undefined, audio: any, file: any;
    for await (const part of (req as any).parts()) {
      if (part.type === "field" && part.fieldname === "text") text = String(part.value);
      else if (part.type === "file") {
        const buf = await part.toBuffer();
        if (String(part.mimetype).startsWith("audio") || part.fieldname === "audio")
          audio = { buf, name: part.filename };
        else file = { buf, name: part.filename };
      }
    }
    return ingest({ text, audio, file });
  });

  app.get("/graph", async (req) => {
    const view = ((req.query as any).view ?? "radial") as string;
    const n = await db.query(`select id,type,label,color,dept_id from nodes`);
    const e = await db.query(`select src,dst,kind from edges`);
    if (view === "neural") return { view, nodes: n.rows, links: e.rows };   // force-layout client-side
    const depts = n.rows.filter((r: any) => r.type === "dept");
    const byDept: Record<string, any[]> = {};
    for (const r of n.rows as any[]) if (r.dept_id && r.type !== "dept") (byDept[r.dept_id] ??= []).push(r);
    const pos = new Map<string, any>();
    const nexus = (n.rows as any[]).find(r => r.label === "Notes" && !r.dept_id);
    if (nexus) pos.set(nexus.id, { x: 0, y: 0 });
    depts.forEach((d: any, i: number) => {
      const a0 = (i / depts.length) * 2 * Math.PI - Math.PI / 2, a1 = a0 + (2 * Math.PI) / depts.length;
      pos.set(d.id, polar(1, (a0 + a1) / 2));
      const per: Record<string, any[]> = {};
      (byDept[d.id] ?? []).forEach(m => (per[m.type] ??= []).push(m));
      for (const [type, items] of Object.entries(per))
        items.forEach((m, j) => pos.set(m.id, polar(RING[type] ?? 2, a0 + ((j + 1) / (items.length + 1)) * (a1 - a0))));
    });
    // dept slug rides on the dept node itself (dept nodes have no dept_id)
    const deptSlugByNodeLabel = Object.fromEntries(
      (await db.query(`select label,slug from departments`)).rows.map((d: any) => [d.label, d.slug]));
    return { view,
      nodes: (n.rows as any[]).map(r => ({ ...r,
        slug: r.type === "dept" ? deptSlugByNodeLabel[r.label] : undefined,
        ...(pos.get(r.id) ?? {}) })),
      links: e.rows };
  });

  app.get("/depts/:slug/subgraph", async (req) => {
    const { slug } = req.params as any;
    const n = await db.query(`
      with d as (select id from departments where slug=$1)
      select id,type,label,color,dept_id from nodes
      where dept_id=(select id from d)
         or id in (select e.dst from edges e join nodes s on s.id=e.src
                   where s.dept_id=(select id from d) and e.kind='uses')`, [slug]);
    const ids = n.rows.map((r: any) => r.id);
    const e = await db.query(`select src,dst,kind from edges where src=any($1) and dst=any($1)`, [ids]);
    return { dept: slug, nodes: n.rows, links: e.rows };
  });

  app.post("/search", async (req) => {
    const { query, k = 8 } = req.body as any;
    const v = await embed(query);
    const vec = await db.query(
      `select nb.vault_path, e.chunk_text, round((1-(e.embedding <=> $1::vector))::numeric,3) sim
       from embeddings e join note_bodies nb on nb.id=e.note_id
       order by e.embedding <=> $1::vector limit $2`, [JSON.stringify(v), k]);
    const like = await db.query(
      `select distinct nb.vault_path, left(nb.body_md,180) chunk_text, 0.5 sim
       from note_bodies nb where nb.body_md ilike $1 limit $2`, [`%${query}%`, k]);
    const seen = new Set<string>();
    return { results: [...vec.rows, ...like.rows]
      .filter((x: any) => seen.has(x.vault_path) ? false : (seen.add(x.vault_path), true)).slice(0, k) };
  });

  app.get("/stats", async () => (await db.query(`select type, count(*) from nodes group by type`)).rows);
}
