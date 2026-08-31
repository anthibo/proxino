import { useState, useRef } from "react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { deriveClients } from "../clients";
import { setClientLabel } from "../api";
import { DeviceIcon } from "./DeviceIcon";

export function ClientsSidebar() {
  const flows = useStore(useShallow((s) => s.allFlows()));
  const clientIp = useStore((s) => s.clientIp);
  const selectClient = useStore((s) => s.selectClient);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const cancelRef = useRef(false);
  const commit = (ip: string) => { setClientLabel(ip, draft).catch(() => {}); setLabels((m) => ({ ...m, [ip]: draft })); setEditing(null); };
  const clients = deriveClients(flows, labels);
  const total = clients.reduce((n, c) => n + c.count, 0);
  return (
    <div className="sidebar">
      <div className="side-head"><span>CLIENTS</span><span className="side-count">{clients.length}</span></div>
      <div className={"client" + (clientIp === null ? " selected" : "")} onClick={() => selectClient(null)}>
        <span className="client-ico"><DeviceIcon kind="desktop" /></span>
        <span className="client-main">
          <span className="client-name">All traffic</span>
          <span className="client-sub">every client</span>
        </span>
        <span className="badge">{total.toLocaleString()}</span>
      </div>
      {clients.map((c) => (
        <div key={c.ip} className={"client" + (clientIp === c.ip ? " selected" : "")}
             onClick={() => selectClient(c.ip)}>
          <span className="client-ico"><DeviceIcon kind={c.kind} /></span>
          <span className="client-main">
            {editing === c.ip ? (
              <input autoFocus className="client-edit" value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") { cancelRef.current = true; e.currentTarget.blur(); }
                }}
                onBlur={() => {
                  if (cancelRef.current) { cancelRef.current = false; setEditing(null); return; }
                  commit(c.ip);
                }} />
            ) : (
              <span className="client-name" title="Double-click to rename"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditing(c.ip); setDraft(c.label); }}>
                {c.label}<span className="client-dot" />
              </span>
            )}
            <span className="client-sub">{c.ip}</span>
          </span>
          <span className="badge">{c.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
