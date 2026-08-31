export type JsonType = "string" | "number" | "boolean" | "null" | "object" | "array";

export function classify(v: unknown): JsonType {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as JsonType;
}

export function childCount(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.keys(v).length;
  return 0;
}

export function collapsedLabel(v: unknown): string {
  const n = childCount(v);
  if (Array.isArray(v)) return `[ … ] ${n} ${n === 1 ? "item" : "items"}`;
  return `{ … } ${n} ${n === 1 ? "key" : "keys"}`;
}
