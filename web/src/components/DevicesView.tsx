import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { deviceStats } from "../metrics";
import { bytes } from "../format";
import { DeviceIcon } from "./DeviceIcon";

function ago(ts: number): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
const errColor = (r: number) => (r >= 0.1 ? "var(--err5xx)" : r >= 0.03 ? "var(--err4xx)" : "var(--ok)");

export function DevicesView({ onConnect }: { onConnect: () => void }) {
  const flows = useStore(useShallow((s) => s.allFlows()));
  const devices = deviceStats(flows);
  return (
    <div className="devices-view">
      <div className="dv-head">
        <h2>Devices</h2>
        <span className="dv-badge">{devices.length} {devices.length === 1 ? "device" : "devices"}</span>
        <span className="topbar-spacer" />
        <button className="chip primary" onClick={onConnect}>＋ Pair new device</button>
      </div>
      {devices.length === 0 ? (
        <div className="empty">No devices yet — connect one to get started.</div>
      ) : (
        <div className="dv-list">
          {devices.map((d) => (
            <div key={d.ip} className="dv-card">
              <span className="dv-ico"><DeviceIcon kind={d.kind} size={22} /></span>
              <div className="dv-id">
                <div className="dv-name">{d.label}<span className="client-dot" /></div>
                <div className="dv-ip">{d.ip}</div>
              </div>
              <div className="dv-stats">
                <div className="dv-stat"><span className="dv-k">REQUESTS</span><span className="dv-v mono">{d.count.toLocaleString()}</span></div>
                <div className="dv-stat"><span className="dv-k">ERROR RATE</span><span className="dv-v" style={{ color: errColor(d.errorRate) }}>{(d.errorRate * 100).toFixed(1)}%</span></div>
                <div className="dv-stat"><span className="dv-k">AVG LATENCY</span><span className="dv-v mono">{d.avgMs} ms</span></div>
                <div className="dv-stat"><span className="dv-k">DATA</span><span className="dv-v mono">{bytes(d.bytes)}</span></div>
                <div className="dv-stat"><span className="dv-k">LAST SEEN</span><span className="dv-v">{ago(d.lastSeen)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
