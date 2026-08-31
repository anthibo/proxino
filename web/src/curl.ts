import type { FlowDetail } from "./types";
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
export function toCurl(d: FlowDetail): string {
  const url = `${d.scheme}://${d.host}${d.path}${d.query ? "?" + d.query : ""}`;
  const parts = [`curl -X ${d.method} ${q(url)}`];
  for (const [k, v] of d.request.headers) parts.push(`-H ${q(`${k}: ${v}`)}`);
  if (d.request.body) parts.push(`--data-raw ${q(d.request.body)}`);
  return parts.join(" \\\n  ");
}
