import { Queue, Worker } from "bullmq";
import { db } from "../db.js";
import { runAgent } from "./runner.js";
import { runStandup } from "./conductor.js";
import { runAllProbes } from "../connectors/index.js";

const connection = { url: process.env.REDIS_URL ?? "redis://redis:6379" };
const QUEUE = "agent-cron";

// Every agents.schedule_cron becomes a BullMQ repeatable job; each firing is
// one logged run. Redis down → the API still serves, scheduler just reports off.
export async function startScheduler(): Promise<{ scheduled: number } | { error: string }> {
  try {
    const q = new Queue(QUEUE, { connection });
    for (const job of await q.getRepeatableJobs()) await q.removeRepeatableByKey(job.key);

    const agents = (await db.query(
      `select slug, schedule_cron from agents
       where schedule_cron is not null and status in ('live','shadow')`)).rows;
    for (const a of agents)
      await q.add(a.slug, { slug: a.slug }, { repeat: { pattern: a.schedule_cron } });
    await q.add("conductor-standup", { slug: "conductor", standup: true },
      { repeat: { pattern: "0 7 * * *" } });
    await q.add("connector-health", { connectorHealth: true },
      { repeat: { pattern: "*/5 * * * *" } });

    new Worker(QUEUE, async job =>
      job.data.standup ? runStandup() : job.data.connectorHealth ? runAllProbes() : runAgent(job.data.slug, "schedule"),
      { connection, concurrency: 3 });

    return { scheduled: agents.length + 2 };
  } catch (e: any) {
    return { error: `scheduler offline: ${String(e?.message ?? e).slice(0, 200)}` };
  }
}
