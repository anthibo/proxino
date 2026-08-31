import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { deriveClients } from "../clients";
import { bytes } from "../format";

export function StatusBar() {
  const flows = useStore(useShallow((s) => s.allFlows()));
  const clients = deriveClients(flows, {});
  let down = 0, up = 0;
  const cutoff = Date.now() - 60_000;
  let recent = 0;
  for (const f of flows) {
    down += f.response?.size ?? 0;
    up += f.request?.size ?? 0;
    if (f.timestamp >= cutoff) recent++;
  }
  const protocols = new Set(flows.map((f) => f.http_version).filter(Boolean));
  const proto = protocols.size === 1 ? [...protocols][0] : protocols.size ? "mixed" : "—";
  return (
    <div className="statusbar">
      <span className="sb-dot rec" />
      <span className="sb-item">Recording</span>
      <span className="sb-sep">·</span>
      <span className="sb-item mono">{flows.length.toLocaleString()} requests</span>
      <span className="sb-sep">·</span>
      <span className="sb-item">{clients.length} {clients.length === 1 ? "client" : "clients"}</span>
      <span className="sb-spacer" />
      <span className="sb-item">{proto}</span>
      <span className="sb-sep">·</span>
      <span className="sb-item mono">↓ {bytes(down)}  ↑ {bytes(up)}</span>
      <span className="sb-sep">·</span>
      <span className="sb-item mono">{recent}/min</span>
    </div>
  );
}
