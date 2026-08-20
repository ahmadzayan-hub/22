import { db } from "../db.js";

// Optional outbound alert on new incidents. Unset ALERT_WEBHOOK_URL -> no-op,
// same graceful-degrade pattern as the LLM/connector fallbacks elsewhere.
async function notify(message: string, severity: number): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[ALKAHTANI OS] ${severity >= 2 ? "🔴" : "🟡"} ${message}` }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* alert delivery is best-effort, never blocks the caller */ }
}

export async function raiseIncident(opts: {
  agentId?: string; connectorId?: string; severity?: number; message: string;
}): Promise<void> {
  const { agentId, connectorId, severity = 2, message } = opts;
  await db.query(
    `insert into incidents (agent_id, connector_id, severity, message) values ($1,$2,$3,$4)`,
    [agentId ?? null, connectorId ?? null, severity, message.slice(0, 500)]);
  await notify(message, severity);
}
