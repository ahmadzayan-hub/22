import { db } from "../db.js";
import { llmJson } from "../services/ollama.js";
import { writeNote } from "../services/markdown.js";
import { runAgent } from "./runner.js";
import { CREWS } from "./tmux.js";
import fs from "node:fs";
import path from "node:path";
import { VAULT } from "../services/markdown.js";

async function gatherState() {
  const [failed, stalled, overdue, unread] = await Promise.all([
    db.query(`select a.slug, count(*) fails from agent_runs r join agents a on a.id=r.agent_id
              where r.started_at > now() - interval '24 hours' and r.success = false
              group by a.slug`),
    db.query(`select title, value_usd from deals where stalled and stage not in ('closed_won','lost') limit 10`),
    db.query(`select title, coalesce(d.slug,'tech') crew from tasks t
              left join departments d on d.id=t.dept_id
              where t.state='open' and (t.due_at < now() or t.due_at is null)
              order by t.due_at nulls last limit 15`),
    db.query(`select channel, counterpart, summary from messages
              where handled_by is null and sent_at is null
                and received_at < now() - interval '24 hours' limit 10`),
  ]);
  return { failed: failed.rows, stalled: stalled.rows, overdue: overdue.rows, unread: unread.rows };
}

type Standup = { summary_lines: string[]; crew_tasks: { crew: string; title: string }[] };

// Daily standup: read yesterday's runs, flag failures, stalled deals, overdue
// tasks, stale comms → <=3 prioritized tasks per crew boss + 10-line banner.
export async function runStandup() {
  const state = await gatherState();
  const day = new Date().toISOString().slice(0, 10);

  let plan: Standup;
  try {
    plan = await llmJson<Standup>(
`You are CONDUCTOR, super agent of ALKAHTANI OS. Today's state:
${JSON.stringify(state).slice(0, 5000)}
Crews: ${CREWS.join(", ")}.
Produce JSON {"summary_lines": string[10 max], "crew_tasks": [{"crew","title"}]} with at most 3 tasks per crew,
prioritizing failures, stalled deals, overdue tasks, stale comms. Never propose paid/external actions.`);
  } catch {
    // deterministic fallback: LLM down must not kill the standup
    plan = {
      summary_lines: [
        `standup ${day} (deterministic fallback — LLM unreachable)`,
        `agents with failed runs (24h): ${state.failed.length}`,
        `stalled deals: ${state.stalled.length}`,
        `open/overdue tasks: ${state.overdue.length}`,
        `comms unread > 24h: ${state.unread.length}`,
      ],
      crew_tasks: state.stalled.slice(0, 3).map((d: any) =>
        ({ crew: "sales", title: `Unstall deal: ${d.title}` })),
    };
  }

  const perCrew: Record<string, number> = {};
  for (const t of plan.crew_tasks ?? []) {
    if (!CREWS.includes(t.crew) || (perCrew[t.crew] = (perCrew[t.crew] ?? 0) + 1) > 3) continue;
    await db.query(
      `insert into tasks (title,dept_id,state,created_by)
       values ($1,(select id from departments where slug=$2),'open','conductor')`,
      [t.title.slice(0, 200), t.crew]);
  }

  const md = `# Standup — ${day}\n\n${(plan.summary_lines ?? []).map(l => `- ${l}`).join("\n")}\n\n` +
    `## Broadcast\n${(plan.crew_tasks ?? []).map(t => `- **${t.crew}** — ${t.title}`).join("\n")}\n`;
  writeNote(`notes/standups/${day}.md`, { dept: "tech", tags: ["standup"], source: "agent", date: day }, md);

  await db.query(
    `insert into kpi_daily (day, snapshot) values (current_date, $1)
     on conflict (day) do update set snapshot = kpi_daily.snapshot || $1`,
    [JSON.stringify({ banner: (plan.summary_lines ?? []).slice(0, 10) })]);

  const cid = (await db.query(`select id from agents where slug='conductor'`)).rows[0];
  if (cid) await db.query(
    `insert into agent_runs (agent_id,started_at,finished_at,success,output_md)
     values ($1,now(),now(),true,$2)`, [cid.id, md]);
  return { day, tasks_created: (plan.crew_tasks ?? []).length, banner: plan.summary_lines };
}

// broadcast: one inbox task per crew boss, tagged from Conductor.
export async function broadcast(message: string) {
  for (const crew of CREWS)
    await db.query(
      `insert into tasks (title,dept_id,state,created_by)
       values ($1,(select id from departments where slug=$2),'open','conductor')`,
      [`[broadcast] ${message}`.slice(0, 200), crew]);
  return { delivered: CREWS };
}

// openclaw: spawn an ad-hoc sub-agent (DISABLED-equivalent shadow identity) and
// give it one shadow run immediately. Never enabled without Operator approval.
export async function openclaw(mission: string) {
  const slug = `openclaw-${Date.now().toString(36)}`;
  const md = `---
id: ${slug}
name: OpenClaw ${slug.slice(-4)}
crew: tech
role: Ad-hoc sub-agent (openclaw)
model: grok-4
reports_to: conductor
tools: [gbrain]
permissions: [read_gbrain]
schedule: ""
status: shadow
version: 1
---

# MISSION
${mission}

# RULES
## MUST
- Single mission, then retire. Cite G-Brain notes used.
## MUST NOT
- No external calls, sends, or paid actions.

# MEMORY
- top-k query: "${mission.slice(0, 60).replace(/"/g, "")}" (k=8)

# WORKFLOW
1 Retrieve context. 2 Reason. 3 Write brief. 4 Log run.

# OUTPUT FORMAT
json {brief_md}

# ESCALATION
- Anything beyond read-only -> open approval.`;
  fs.mkdirSync(path.join(VAULT, "agents"), { recursive: true });
  fs.writeFileSync(path.join(VAULT, "agents", `${slug}.md`), md);
  await db.query(
    `insert into agents (slug,name,dept_id,role,identity_path,tools,status)
     values ($1,$2,(select id from departments where slug='tech'),$3,$4,$5,'shadow')`,
    [slug, `OpenClaw ${slug.slice(-4)}`, "Ad-hoc sub-agent (openclaw)",
     `/vault/agents/${slug}.md`, ["gbrain"]]);
  const result = await runAgent(slug, "shadow", mission);
  return { agent: slug, ...result };
}

// Operator chat: status + G-Brain aware, may create tasks; everything else is a reply.
export async function chat(message: string) {
  const [agents, tasks] = await Promise.all([
    db.query(`select count(*) filter (where status='live') l, count(*) t from agents`),
    db.query(`select count(*) filter (where state='open') o, count(*) t from tasks`),
  ]);
  try {
    const r = await llmJson<{ reply: string; create_tasks?: { crew: string; title: string }[] }>(
`You are CONDUCTOR of ALKAHTANI OS — you reach all agents. Live agents: ${agents.rows[0].l}/${agents.rows[0].t}. Open tasks: ${tasks.rows[0].o}/${tasks.rows[0].t}.
Operator says: "${message.slice(0, 2000)}"
Reply as JSON {"reply": string, "create_tasks": [{"crew","title"}]}. Crews: ${CREWS.join(", ")}. No paid/external actions.`);
    for (const t of r.create_tasks ?? [])
      if (CREWS.includes(t.crew))
        await db.query(
          `insert into tasks (title,dept_id,state,created_by)
           values ($1,(select id from departments where slug=$2),'open','conductor')`,
          [t.title.slice(0, 200), t.crew]);
    return { reply: r.reply, tasks_created: (r.create_tasks ?? []).length };
  } catch (e: any) {
    return { reply: `Conductor is degraded (LLM unreachable: ${String(e?.message ?? e)}). ` +
                    `Status — agents ${agents.rows[0].l}/${agents.rows[0].t} live, ${tasks.rows[0].o} open tasks.`,
             tasks_created: 0 };
  }
}
