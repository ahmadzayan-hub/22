import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

export const CREWS = ["sales", "finances", "clients", "marketing", "tech", "communications"];
const session = (crew: string) => `os-${crew}`;

async function tmux(...args: string[]): Promise<string> {
  const { stdout } = await run("tmux", args);
  return stdout.trim();
}

export async function listSessions() {
  try {
    const out = await tmux("list-sessions", "-F", "#{session_name}:#{session_windows}:#{session_created}");
    const alive = new Map(out.split("\n").filter(Boolean).map(l => {
      const [name, windows, created] = l.split(":");
      return [name, { windows: +windows, created: +created }] as const;
    }));
    return { available: true, sessions: CREWS.map(c => ({
      crew: c, alive: alive.has(session(c)), ...alive.get(session(c)) })) };
  } catch {
    return { available: false, sessions: CREWS.map(c => ({ crew: c, alive: false })) };
  }
}

export async function ensureSessions() {
  const st = await listSessions();
  if (!st.available) return st;
  for (const s of st.sessions) if (!s.alive)
    await tmux("new-session", "-d", "-s", session(s.crew), "-n", "boss").catch(() => {});
  return listSessions();
}

export async function restartCrew(crew: string) {
  if (!CREWS.includes(crew)) throw Object.assign(new Error(`unknown crew ${crew}`), { statusCode: 404 });
  await tmux("kill-session", "-t", session(crew)).catch(() => {});
  await tmux("new-session", "-d", "-s", session(crew), "-n", "boss");
  return { crew, restarted: true };
}
