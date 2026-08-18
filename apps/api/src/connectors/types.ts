export type ConnStatus = "live" | "degraded" | "offline";

export type ProbeResult = {
  status: ConnStatus;
  latency_ms: number | null;
  detail: string;
};

export type Probe = () => Promise<ProbeResult>;
