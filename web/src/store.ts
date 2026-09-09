import { create } from "zustand";
import type { FlowMeta, FlowDetail, PassthroughHost, WsMessage } from "./types";
import { parseQuery } from "./filters/dsl";

export type View = "inspector" | "devices" | "dashboard";

const DETAIL_WIDTH_KEY = "proxino.detailWidth";
const DEFAULT_DETAIL_WIDTH = 420;

function clampDetailWidth(n: number): number {
  const max = Math.max(320, window.innerWidth * 0.6);
  return Math.min(Math.max(n, 320), max);
}

function loadDetailWidth(): number {
  try {
    const raw = localStorage.getItem(DETAIL_WIDTH_KEY);
    if (raw == null) return DEFAULT_DETAIL_WIDTH;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_DETAIL_WIDTH;
    return clampDetailWidth(n);
  } catch {
    return DEFAULT_DETAIL_WIDTH;
  }
}

interface State {
  flows: Map<string, FlowMeta>;
  order: string[];
  selectedId: string | null;
  detail: FlowDetail | null;
  query: string;
  clientIp: string | null;
  view: View;
  passthrough: PassthroughHost[];
  detailWidth: number;
  wsMessages: Record<string, WsMessage[]>;
  setView: (v: View) => void;
  upsertFlow: (f: FlowMeta) => void;
  setQuery: (q: string) => void;
  selectClient: (ip: string | null) => void;
  select: (id: string | null, detail?: FlowDetail | null) => void;
  setPassthrough: (hosts: PassthroughHost[]) => void;
  setDetailWidth: (n: number) => void;
  appendWsMessage: (flowId: string, m: WsMessage) => void;
  setWsMessages: (flowId: string, msgs: WsMessage[]) => void;
  clear: () => void;
  visibleFlows: () => FlowMeta[];
  allFlows: () => FlowMeta[];
}

export const useStore = create<State>((set, get) => ({
  flows: new Map(), order: [], selectedId: null, detail: null,
  query: "", clientIp: null, view: "inspector", passthrough: [],
  detailWidth: loadDetailWidth(),
  wsMessages: {},
  setView: (view) => set({ view }),
  setPassthrough: (passthrough) => set({ passthrough }),
  setDetailWidth: (n) => {
    const detailWidth = clampDetailWidth(n);
    try { localStorage.setItem(DETAIL_WIDTH_KEY, String(detailWidth)); } catch { /* ignore */ }
    set({ detailWidth });
  },
  upsertFlow: (f) => set((s) => {
    const flows = new Map(s.flows);
    const isNew = !flows.has(f.id);
    flows.set(f.id, f);
    let order = s.order;
    if (isNew) { order = [...s.order, f.id]; if (order.length > 5000) order = order.slice(-5000); }
    return { flows, order };
  }),
  setQuery: (query) => set({ query }),
  selectClient: (clientIp) => set({ clientIp }),
  select: (selectedId, detail = null) => set({ selectedId, detail }),
  appendWsMessage: (flowId, m) => set((s) => {
    const cur = s.wsMessages[flowId] ?? [];
    const next = cur.length >= 500 ? [...cur.slice(cur.length - 499), m] : [...cur, m];
    return { wsMessages: { ...s.wsMessages, [flowId]: next } };
  }),
  setWsMessages: (flowId, msgs) => set((s) => ({ wsMessages: { ...s.wsMessages, [flowId]: msgs.slice(-500) } })),
  clear: () => set({ flows: new Map(), order: [], selectedId: null, detail: null, query: "", clientIp: null, wsMessages: {} }),
  visibleFlows: () => {
    const s = get();
    const pred = parseQuery(s.query);
    const out: FlowMeta[] = [];
    for (let i = s.order.length - 1; i >= 0; i--) {
      const f = s.flows.get(s.order[i])!;
      if (s.clientIp && f.client.ip !== s.clientIp) continue;
      if (pred(f)) out.push(f);
    }
    return out;
  },
  allFlows: () => {
    const s = get();
    return s.order.map((id) => s.flows.get(id)!).reverse();
  },
}));
