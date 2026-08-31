import type { FlowMeta, ClientInfo, DeviceKind } from "./types";
export function deriveClients(flows: FlowMeta[], overrides: Record<string, string>): ClientInfo[] {
  const map = new Map<string, { label: string; count: number; kind: DeviceKind }>();
  for (const f of flows) {
    const cur = map.get(f.client.ip);
    if (cur) { cur.count++; if (cur.kind === "unknown" && f.client.kind) cur.kind = f.client.kind; }
    else map.set(f.client.ip, { label: f.client.label, count: 1, kind: f.client.kind ?? "unknown" });
  }
  return [...map.entries()]
    .map(([ip, v]) => ({ ip, label: overrides[ip] ?? v.label, count: v.count, kind: v.kind }))
    .sort((a, b) => b.count - a.count);
}
