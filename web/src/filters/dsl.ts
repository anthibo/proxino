import type { FlowMeta } from "../types";
export type Predicate = (f: FlowMeta) => boolean;

const wildcard = (pattern: string, value: string): boolean => {
  const re = new RegExp("^" + pattern.split("*").map(escape).join(".*") + "$", "i");
  return re.test(value);
  function escape(s: string) { return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"); }
};

const fieldValue = (f: FlowMeta, field: string): string | number => {
  switch (field) {
    case "method": return f.method;
    case "status": return f.response?.status ?? 0;
    case "host": return f.host;
    case "path": return f.path;
    case "client": return `${f.client.ip} ${f.client.label}`;
    case "dur": return f.duration_ms ?? 0;
    case "size": return f.response?.size ?? 0;
    case "type": return (f.response?.content_type ?? "").split("/").pop()?.split(";")[0] ?? "";
    default: return "";
  }
};

const termPredicate = (token: string): Predicate => {
  const m = token.match(/^(\w+)(>=|<=|:)(.+)$/);
  if (!m) {
    const t = token.toLowerCase();
    return (f) => [f.method, f.host, f.path].some((v) => v.toLowerCase().includes(t));
  }
  const [, field, op, raw] = m;
  if (op === ":" && field === "type" && raw === "ws") {
    return (f) => f.kind === "ws";
  }
  return (f) => {
    const val = fieldValue(f, field);
    if (op === ">=") return Number(val) >= Number(raw);
    if (op === "<=") return Number(val) <= Number(raw);
    if (op === ":") {
      // Check if raw starts with a comparison operator
      if (raw.startsWith(">=")) return Number(val) >= Number(raw.slice(2));
      if (raw.startsWith("<=")) return Number(val) <= Number(raw.slice(2));
      if (raw.includes("*")) return wildcard(raw, String(val));
      return String(val).toLowerCase() === raw.toLowerCase()
        || String(val).toLowerCase().includes(raw.toLowerCase());
    }
    return false;
  };
};

export const parseQuery = (q: string): Predicate => {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return () => true;
  const preds = tokens.map(termPredicate);
  return (f) => preds.every((p) => p(f));
};
