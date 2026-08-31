import type { FlowMeta, DeviceKind } from "./types";

export interface DeviceStat {
  ip: string; label: string; kind: DeviceKind;
  count: number; errorRate: number; avgMs: number; bytes: number; lastSeen: number;
}

/** Per-device aggregates for the Devices view. */
export function deviceStats(flows: FlowMeta[], overrides: Record<string, string> = {}): DeviceStat[] {
  const m = new Map<string, { label: string; kind: DeviceKind; count: number; errs: number; ms: number; msN: number; bytes: number; last: number }>();
  for (const f of flows) {
    let d = m.get(f.client.ip);
    if (!d) { d = { label: f.client.label, kind: f.client.kind ?? "unknown", count: 0, errs: 0, ms: 0, msN: 0, bytes: 0, last: 0 }; m.set(f.client.ip, d); }
    d.count++;
    if (d.kind === "unknown" && f.client.kind) d.kind = f.client.kind;
    if ((f.response?.status ?? 0) >= 400) d.errs++;
    if (f.duration_ms != null) { d.ms += f.duration_ms; d.msN++; }
    d.bytes += (f.response?.size ?? 0) + (f.request?.size ?? 0);
    if (f.timestamp > d.last) d.last = f.timestamp;
  }
  return [...m.entries()].map(([ip, d]) => ({
    ip, label: overrides[ip] ?? d.label, kind: d.kind, count: d.count,
    errorRate: d.count ? d.errs / d.count : 0,
    avgMs: d.msN ? Math.round(d.ms / d.msN) : 0,
    bytes: d.bytes, lastSeen: d.last,
  })).sort((a, b) => b.count - a.count);
}

export interface Dashboard {
  total: number; errorRate: number; avgMs: number; p95Ms: number;
  bytesDown: number; bytesUp: number; perMin: number;
  buckets: { s2: number; s3: number; s4: number; s5: number; pending: number };
  topHosts: { host: string; count: number }[];
  slowest: { id: string; method: string; path: string; ms: number }[];
}

export function dashboard(flows: FlowMeta[]): Dashboard {
  const durs: number[] = [];
  let errs = 0, down = 0, up = 0;
  const buckets = { s2: 0, s3: 0, s4: 0, s5: 0, pending: 0 };
  const hosts = new Map<string, number>();
  const cutoff = Date.now() - 60_000;
  let recent = 0;
  for (const f of flows) {
    const s = f.response?.status;
    if (s == null) buckets.pending++;
    else if (s >= 500) { buckets.s5++; errs++; }
    else if (s >= 400) { buckets.s4++; errs++; }
    else if (s >= 300) buckets.s3++;
    else buckets.s2++;
    if (f.duration_ms != null) durs.push(f.duration_ms);
    down += f.response?.size ?? 0; up += f.request?.size ?? 0;
    hosts.set(f.host, (hosts.get(f.host) ?? 0) + 1);
    if (f.timestamp >= cutoff) recent++;
  }
  const sorted = [...durs].sort((a, b) => a - b);
  const avg = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
  const topHosts = [...hosts.entries()].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const slowest = flows.filter((f) => f.duration_ms != null)
    .sort((a, b) => (b.duration_ms ?? 0) - (a.duration_ms ?? 0)).slice(0, 6)
    .map((f) => ({ id: f.id, method: f.method, path: f.path, ms: f.duration_ms ?? 0 }));
  return {
    total: flows.length, errorRate: flows.length ? errs / flows.length : 0, avgMs: avg, p95Ms: p95,
    bytesDown: down, bytesUp: up, perMin: recent, buckets, topHosts, slowest,
  };
}
