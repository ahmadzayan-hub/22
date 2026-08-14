import crypto from "node:crypto";
import { db } from "../db.js";
import { embed, llmJson, transcribe } from "./ollama.js";
import { chunkMd, writeNote } from "./markdown.js";

const DEPT_KEYWORDS: Record<string, string[]> = {
  sales: ["deal","pipeline","attio","crm","discovery","call roster","vantage","launchpad"],
  finances: ["stripe","payment","invoice","payout","books","reconcil","paypal","square","financ"],
  clients: ["client","onboard","roster","success","retention"],
  marketing: ["post","content","ugc","funnel","dm ","campaign","social","tiktok","reel"],
  tech: ["stack","system","server","bug","deploy","monitor","connector","model"],
  communications: ["inbox","email","gmail","slack","whatsapp","message","digest","triage"] };

async function classifyDept(text: string): Promise<string> {
  const t = text.toLowerCase(); let best = "tech", score = 0;
  for (const [d, ks] of Object.entries(DEPT_KEYWORDS)) {
    const s = ks.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
    if (s > score) { best = d; score = s; }
  }
  if (score >= 2) return best;
  const r = await llmJson<{ dept: string }>(
    `Pick the single best department for this company note. Reply JSON {"dept":slug}, slug in: ${Object.keys(DEPT_KEYWORDS).join("|")}.\nNOTE:\n${text.slice(0, 2000)}`)
    .catch(() => ({ dept: best }));   // keyword fallback if LLM is down
  return Object.keys(DEPT_KEYWORDS).includes(r.dept) ? r.dept : best;
}

export async function ingest(o: { text?: string;
  audio?: { buf: Buffer; name: string }; file?: { buf: Buffer; name: string } }) {

  let text = o.text ?? "", source = "text";
  if (o.audio)      { text = await transcribe(o.audio.buf, o.audio.name); source = "voice"; }
  else if (o.file)  { const { name, buf } = o.file; source = "upload";
    if (/\.pdf$/i.test(name))        { const pdf: any = (await import("pdf-parse")).default; text = (await pdf(buf)).text; }
    else if (/\.docx$/i.test(name))  { const m: any = await import("mammoth"); text = (await m.extractRawText({ buffer: buf })).value; }
    else text = buf.toString("utf8");
  }
  if (!text.trim()) throw Object.assign(new Error("empty input"), { statusCode: 422 });

  const dept = await classifyDept(text);
  const day  = new Date().toISOString().slice(0, 10);
  const rel  = `notes/${dept}/${day}-${crypto.randomBytes(3).toString("hex")}.md`;
  writeNote(rel, { dept, tags: ["ingest"], source, date: day }, text);   // vault = source of truth

  const node = (await db.query(
    `insert into nodes (type,label,dept_id,meta)
     values ('note',$1,(select id from departments where slug=$2),$3) returning id`,
    [text.slice(0, 80), dept, JSON.stringify({ source, vault: rel })])).rows[0];

  const nb = (await db.query(
    `insert into note_bodies (node_id,vault_path,body_md,frontmatter,source_type,created_by)
     values ($1,$2,$3,$4,$5,'operator') returning id`,
    [node.id, rel, text, JSON.stringify({ dept, source, date: day }), source])).rows[0];

  await db.query(
    `insert into edges (src,dst,kind)
     values ($1,(select id from departments where slug=$2),'references') on conflict do nothing`,
    [node.id, dept]);

  const tools = await db.query(`select id,label from nodes where type='tool'`);
  const low = text.toLowerCase();
  for (const t of tools.rows)
    if (low.includes(String(t.label).toLowerCase()))
      await db.query(`insert into edges (src,dst,kind) values ($1,$2,'references') on conflict do nothing`, [node.id, t.id]);

  const chunks = chunkMd(text);
  for (let i = 0; i < chunks.length; i++) {
    const v = await embed(chunks[i]);
    await db.query(
      `insert into embeddings (note_id,chunk_idx,chunk_text,embedding) values ($1,$2,$3,$4::vector)`,
      [nb.id, i, chunks[i], JSON.stringify(v)]);
  }
  return { node: node.id, dept, chunks: chunks.length, vault: rel };
}
