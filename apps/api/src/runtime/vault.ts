import fs from "node:fs";
import path from "node:path";
import { db } from "../db.js";
import { VAULT } from "../services/markdown.js";

export type Identity = {
  slug: string; name: string; crew: string; role: string; model: string;
  tools: string[]; permissions: string[]; schedule?: string; status: string;
  reports_to: string; sections: Record<string, string>; raw: string; relPath: string;
};

// Minimal frontmatter parser for the AGENT CONTRACT format:
// `key: value` and `key: [a, b, c]`. Vault files are ours, not arbitrary YAML.
function parseFrontmatter(src: string): Record<string, any> {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, any> = {};
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v: any = kv[2].trim().replace(/^"|"$/g, "");
    if (v.startsWith("[")) v = v.slice(1, -1).split(",").map((s: string) => s.trim()).filter(Boolean);
    out[kv[1]] = v;
  }
  return out;
}

function parseSections(src: string): Record<string, string> {
  const body = src.replace(/^---\n[\s\S]*?\n---/, "");
  const out: Record<string, string> = {};
  const parts = body.split(/^# +/m).filter(Boolean);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    out[p.slice(0, nl).trim().toUpperCase()] = p.slice(nl + 1).trim();
  }
  return out;
}

export function parseIdentity(absPath: string): Identity {
  const raw = fs.readFileSync(absPath, "utf8");
  const fm = parseFrontmatter(raw);
  return {
    slug: fm.id, name: fm.name ?? fm.id, crew: fm.crew ?? "tech",
    role: fm.role ?? "", model: fm.model ?? "qwen3.6-hermes-local",
    tools: Array.isArray(fm.tools) ? fm.tools : [], permissions: Array.isArray(fm.permissions) ? fm.permissions : [],
    schedule: fm.schedule || undefined, status: fm.status ?? "disabled",
    reports_to: fm.reports_to ?? "conductor",
    sections: parseSections(raw), raw,
    relPath: `/vault/agents/${path.basename(absPath)}`,
  };
}

export function loadVault(): Identity[] {
  const dir = path.join(VAULT, "agents");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".md"))
    .map(f => parseIdentity(path.join(dir, f)))
    .filter(i => !!i.slug);
}

// Vault is the source of truth for identity fields; DB keeps runtime status
// (an Operator enable via approval must survive a re-sync).
export async function syncVault(): Promise<number> {
  const ids = loadVault();
  for (const i of ids) {
    await db.query(
      `insert into agents (slug,name,dept_id,role,model,identity_path,schedule_cron,tools,permissions,status)
       values ($1,$2,(select id from departments where slug=$3),$4,$5,$6,$7,$8,$9,$10)
       on conflict (slug) do update set
         name=excluded.name, dept_id=excluded.dept_id, role=excluded.role, model=excluded.model,
         identity_path=excluded.identity_path, schedule_cron=excluded.schedule_cron,
         tools=excluded.tools, permissions=excluded.permissions`,
      [i.slug, i.name, i.crew === "conductor" ? "tech" : i.crew, i.role, i.model,
       i.relPath, i.schedule ?? null, i.tools, i.permissions, i.status]);
  }
  return ids.length;
}

export function identityFor(slug: string): Identity | undefined {
  const p = path.join(VAULT, "agents", `${slug}.md`);
  return fs.existsSync(p) ? parseIdentity(p) : undefined;
}
