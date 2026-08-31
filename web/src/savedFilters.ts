export type SavedFilter = { name: string; query: string; fav: boolean };
const KEY = "proxino.savedFilters";

export function listSaved(): SavedFilter[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: SavedFilter[]): void { localStorage.setItem(KEY, JSON.stringify(list)); }

export function saveFilter(name: string, query: string): void {
  const list = listSaved();
  const existing = list.find((f) => f.name === name);
  if (existing) existing.query = query;
  else list.push({ name, query, fav: false });
  write(list);
}
export function removeFilter(name: string): void {
  write(listSaved().filter((f) => f.name !== name));
}
export function toggleFav(name: string): void {
  const list = listSaved();
  const f = list.find((x) => x.name === name);
  if (f) { f.fav = !f.fav; write(list); }
}
