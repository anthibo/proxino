import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { fetchWsMessages } from "../api";
import { bytes } from "../format";

const Arrow = ({ dir }: { dir: "in" | "out" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {dir === "out" ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
  </svg>
);
const fmt = (t: number) => { const d = new Date(t * 1000); return `${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`; };

export function WsMessages({ flowId }: { flowId: string }) {
  const msgs = useStore((s) => s.wsMessages[flowId] ?? []);
  const setWsMessages = useStore((s) => s.setWsMessages);
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [q, setQ] = useState("");
  const [follow, setFollow] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { fetchWsMessages(flowId).then((r) => setWsMessages(flowId, r.messages)).catch(() => {}); }, [flowId, setWsMessages]);
  useEffect(() => { if (follow) endRef.current?.scrollIntoView?.({ block: "end" }); }, [msgs.length, follow]);
  const rows = useMemo(() => msgs.filter((m) => (dir === "all" || m.dir === dir) && (!q || (m.text ?? "").toLowerCase().includes(q.toLowerCase()))), [msgs, dir, q]);
  return (
    <div className="wsm">
      <div className="wsm-bar">
        {(["all", "in", "out"] as const).map((d) => <button key={d} className={"chip" + (dir === d ? " active" : "")} onClick={() => setDir(d)}>{d}</button>)}
        <input className="wsm-search" placeholder="Search frames" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="wsm-follow"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow</label>
      </div>
      <div className="wsm-list" role="table">
        {rows.map((m) => (
          <div key={m.i} role="row" className={"wsm-row " + m.dir + (open === m.i ? " open" : "")} onClick={() => setOpen(open === m.i ? null : m.i)}>
            <span className="wsm-dir"><Arrow dir={m.dir} /></span>
            <span className="wsm-time mono">{fmt(m.t)}</span>
            <span className="wsm-size mono">{m.type === "binary" ? `binary · ${bytes(m.size)}` : bytes(m.size)}</span>
            <span className="wsm-preview mono">{m.text ?? (m.view ? `${m.view} frame` : "")}</span>
            {open === m.i && (m.pretty || m.text) && (
              <div className="wsm-body" onClick={(e) => e.stopPropagation()}>
                {m.view && <span className="badge">{m.view}</span>}
                <pre className="mono">{m.pretty ?? m.text}</pre>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
