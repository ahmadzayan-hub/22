import { db } from "../db.js";
import { embed, llmJson } from "../services/ollama.js";
import { writeNote } from "../services/markdown.js";
import { identityFor } from "./vault.js";

type RunPlan = {
  brief_md: string;
  tasks_to_create?: { title: string; crew?: string }[];
  needs_approval?: { kind: string; reason: string }[];
};

async function topK(query: string, k = 6): Promise<string> {
  try {
    const v = await embed(query);
    const r = await db.query(
      `select e.chunk_text from embeddings e
       order by e.embedding <=> $1::vector limit $2`, [JSON.stringify(v), k]);
    return r.rows.map((x: any) => x.chunk_text).join("\n---\n");
  } catch { return ""; }   // G-Brain empty or embedder down → run without context
}

// Identity + top-k G-Brain context → LLM → tasks/approvals → output md + agent_runs row.
export async function runAgent(slug: string, trigger = "operator", extra = ""): Promise<any> {
  const id = identityFor(slug);
  if (!id) throw Object.assign(new Error(`unknown agent ${slug}`), { statusCode: 404 });
  const row = (await db.query(`select id,status from agents where slug=$1`, [slug])).rows[0];
  if (!row) throw Object.assign(new Error(`agent ${slug} not in db (run vault sync)`), { statusCode: 404 });
  if (row.status === "disabled" && trigger !== "shadow")
    throw Object.assign(new Error(`agent ${slug} is disabled`), { statusCode: 409 });

  const run = (await db.query(
    `insert into agent_runs (agent_id,trace_id,context) values ($1,gen_random_uuid(),$2) returning id`,
    [row.id, JSON.stringify({ trigger, extra })])).rows[0];

  try {
    const memQuery = (id.sections["MEMORY"] ?? "").match(/"([^"]+)"/)?.[1] ?? `${id.crew} ${id.role}`;
    const context = await topK(memQuery);
    const plan = await llmJson<RunPlan>(
`You are agent "${id.name}" of the ${id.crew} crew in ALKAHTANI OS.
IDENTITY (obey RULES; paid/destructive actions go to needs_approval, never executed):
${id.raw.slice(0, 4000)}

G-BRAIN CONTEXT (top-k):
${context.slice(0, 4000) || "(none)"}

TRIGGER: ${trigger}${extra ? ` — ${extra}` : ""}
Reply as JSON: {"brief_md": string, "tasks_to_create": [{"title","crew"}], "needs_approval": [{"kind","reason"}]}`);

    for (const t of plan.tasks_to_create ?? [])
      await db.query(
        `insert into tasks (title,dept_id,state,created_by)
         values ($1,(select id from departments where slug=$2),'open',$3)`,
        [t.title.slice(0, 200), t.crew ?? id.crew, slug]);
    for (const a of plan.needs_approval ?? [])
      await db.query(
        `insert into approvals (kind,requested_by,payload)
         values ('destructive_action',$1,$2)`,
        [row.id, JSON.stringify({ agent: slug, ...a })]);

    const day = new Date().toISOString().slice(0, 10);
    const rel = `crews/${id.crew}/notes/${day}-${slug}.md`;
    writeNote(rel, { agent: slug, crew: id.crew, trigger, date: day }, plan.brief_md ?? "(no output)");

    await db.query(
      `update agent_runs set finished_at=now(), success=true, output_md=$2 where id=$1`,
      [run.id, plan.brief_md ?? ""]);
    return { run_id: run.id, success: true, tasks: (plan.tasks_to_create ?? []).length,
             approvals: (plan.needs_approval ?? []).length, vault: rel };
  } catch (e: any) {
    await db.query(
      `update agent_runs set finished_at=now(), success=false, error=$2 where id=$1`,
      [run.id, String(e?.message ?? e).slice(0, 500)]);
    return { run_id: run.id, success: false, error: String(e?.message ?? e) };
  }
}
