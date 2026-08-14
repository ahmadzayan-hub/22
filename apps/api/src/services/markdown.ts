import fs from "node:fs"; import path from "node:path";
export const VAULT = process.env.VAULT_PATH ?? "./vault";
export type FM = Record<string, string | string[]>;

export function writeNote(rel: string, fm: FM, body: string): string {
  const p = path.join(VAULT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const y = Object.entries(fm).map(([k, v]) =>
    `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`).join("\n");
  fs.writeFileSync(p, `---\n${y}\n---\n\n${body}\n`);
  return p;
}

export function chunkMd(body: string, size = 900): string[] {
  const parts = body.split(/\n{2,}|\n(?=#)/).map(s => s.trim()).filter(Boolean);
  const out: string[] = []; let cur = "";
  for (const p of parts) {
    if ((cur + p).length > size && cur) { out.push(cur.trim()); cur = ""; }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
