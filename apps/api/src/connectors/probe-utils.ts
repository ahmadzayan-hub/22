import type { ProbeResult } from "./types.js";

const TIMEOUT_MS = 6000;
const DEGRADED_MS = 1500; // a live response slower than this reads as degraded, not down

export function missingEnv(vars: Record<string, string | undefined>): string[] {
  return Object.entries(vars).filter(([, v]) => !v).map(([k]) => k);
}

export function unconfigured(vars: Record<string, string | undefined>): ProbeResult {
  return { status: "offline", latency_ms: null, detail: `not configured: ${missingEnv(vars).join(", ")}` };
}

// Times a fetch, enforces a timeout, and never throws — network/HTTP failure
// becomes an "offline" ProbeResult instead of killing the health-check pass.
export async function probeFetch(
  url: string,
  init: RequestInit,
  classify: (res: Response, body: any) => ProbeResult | Promise<ProbeResult>,
): Promise<ProbeResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const latency_ms = Date.now() - started;
    let body: any = null;
    try { body = await res.clone().json(); } catch { /* non-JSON body is fine */ }
    if (!res.ok) return { status: "offline", latency_ms, detail: `HTTP ${res.status}` };
    const r = await classify(res, body);
    if (r.status === "live" && latency_ms > DEGRADED_MS)
      return { ...r, status: "degraded", detail: `${r.detail} (slow: ${latency_ms}ms)` };
    return r;
  } catch (e: any) {
    const latency_ms = Date.now() - started;
    return { status: "offline", latency_ms, detail: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}
