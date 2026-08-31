import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { dashboard } from "../metrics";
import { bytes } from "../format";

const STATUS = [
  { key: "s2", label: "2xx", desc: "Success", color: "var(--get)" },
  { key: "s3", label: "3xx", desc: "Redirect", color: "var(--redir)" },
  { key: "s4", label: "4xx", desc: "Client error", color: "var(--err4xx)" },
  { key: "s5", label: "5xx", desc: "Server error", color: "var(--err5xx)" },
] as const;
const methodColor: Record<string, string> = { GET: "var(--get)", POST: "var(--post)", PUT: "var(--put)", DELETE: "var(--delete)", PATCH: "var(--patch)" };

export function DashboardView() {
  const flows = useStore(useShallow((s) => s.allFlows()));
  const d = dashboard(flows);
  const statusTotal = d.buckets.s2 + d.buckets.s3 + d.buckets.s4 + d.buckets.s5 || 1;
  const hostMax = d.topHosts[0]?.count || 1;
  const cards = [
    ["TOTAL REQUESTS", d.total.toLocaleString(), ""],
    ["ERROR RATE", `${(d.errorRate * 100).toFixed(1)}%`, ""],
    ["AVG LATENCY", `${d.avgMs} ms`, `P95 ${d.p95Ms} ms`],
    ["THROUGHPUT", `${d.perMin}/min`, ""],
    ["DATA", bytes(d.bytesDown + d.bytesUp), `↓${bytes(d.bytesDown)} ↑${bytes(d.bytesUp)}`],
  ];
  return (
    <div className="dash-view">
      <div className="dash-head"><h2>Traffic Dashboard</h2></div>
      <div className="dash-cards">
        {cards.map((c) => (
          <div key={c[0]} className="dash-card">
            <div className="dash-k">{c[0]}</div>
            <div className="dash-v">{c[1]}</div>
            {c[2] && <div className="dash-sub">{c[2]}</div>}
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="dash-panel">
          <div className="dash-panel-h">Status codes</div>
          <div className="dash-bar">
            {STATUS.map((s) => {
              const n = d.buckets[s.key];
              return n ? <span key={s.key} className="dash-seg" style={{ width: `${(n / statusTotal) * 100}%`, background: s.color }} /> : null;
            })}
          </div>
          <div className="dash-legend">
            {STATUS.map((s) => (
              <div key={s.key} className="dash-leg-row">
                <span className="dash-dot" style={{ background: s.color }} />
                <span className="dash-leg-code mono">{s.label}</span>
                <span className="dash-leg-desc">{s.desc}</span>
                <span className="dash-leg-n mono">{d.buckets[s.key]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dash-panel">
          <div className="dash-panel-h">Top hosts</div>
          {d.topHosts.length === 0 ? <div className="dash-empty">No traffic yet.</div> : d.topHosts.map((h) => (
            <div key={h.host} className="dash-host">
              <span className="dash-host-name mono">{h.host}</span>
              <span className="dash-host-bar"><span style={{ width: `${(h.count / hostMax) * 100}%` }} /></span>
              <span className="dash-host-n mono">{h.count}</span>
            </div>
          ))}
        </div>
        <div className="dash-panel dash-wide">
          <div className="dash-panel-h">Slowest endpoints</div>
          {d.slowest.length === 0 ? <div className="dash-empty">No completed requests yet.</div> : d.slowest.map((s) => (
            <div key={s.id} className="dash-slow">
              <span className="dash-m mono" style={{ color: methodColor[s.method] ?? "var(--text)" }}>{s.method}</span>
              <span className="dash-path mono">{s.path}</span>
              <span className="dash-ms mono">{s.ms} ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
