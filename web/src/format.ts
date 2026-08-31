export function bytes(n: number | undefined | null): string {
  if (n == null || n === 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short resource-type label derived from a Content-Type header. */
export function typeLabel(ct?: string | null): string {
  if (!ct) return "—";
  const c = ct.toLowerCase();
  if (c.includes("json")) return "json";
  if (c.includes("html")) return "html";
  if (c.includes("javascript")) return "js";
  if (c.includes("css")) return "css";
  if (c.includes("event-stream")) return "sse";
  if (c.includes("xml")) return "xml";
  if (c.startsWith("image/")) return c.slice(6).split(";")[0];
  if (c.startsWith("font/") || c.includes("font")) return "font";
  if (c.includes("text/plain")) return "text";
  return c.split("/")[1]?.split(";")[0] || "—";
}

/** HH:MM:SS.mmm from an epoch-ms timestamp. */
export function clockTime(ms?: number | null): string {
  if (ms == null) return "—";
  const d = new Date(ms);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
