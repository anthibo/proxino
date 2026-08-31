export type Suggestion = { token: string; desc: string };
const FIELDS = ["method", "status", "host", "path", "type", "size", "dur", "client"];
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

export function suggest(query: string): Suggestion[] {
  const last = query.split(/\s+/).pop() ?? "";
  const colon = last.indexOf(":");
  if (colon === -1) {
    return FIELDS.filter((f) => f.startsWith(last))
      .slice(0, 6).map((f) => ({ token: `${f}:`, desc: `Filter by ${f}` }));
  }
  const field = last.slice(0, colon);
  const partial = last.slice(colon + 1);
  if (field === "method") {
    return METHODS.filter((m) => m.startsWith(partial.toUpperCase()))
      .slice(0, 6).map((m) => ({ token: `method:${m}`, desc: `${m} requests` }));
  }
  return [];
}
