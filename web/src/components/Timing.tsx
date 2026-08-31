import type { TimingDetail } from "../types";

const PHASES: { key: keyof TimingDetail; label: string }[] = [
  { key: "connect_ms", label: "Connect" },
  { key: "tls_ms", label: "TLS" },
  { key: "ttfb_ms", label: "Waiting (TTFB)" },
  { key: "download_ms", label: "Download" },
];

export function Timing({ timing }: { timing: TimingDetail }) {
  const rows = PHASES.map((p) => ({ ...p, ms: timing[p.key] as number | null })).filter((r) => r.ms != null);
  if (rows.length === 0) return <div className="timing empty">No timing data</div>;
  const total = timing.duration_ms ?? rows.reduce((s, r) => s + (r.ms as number), 0);
  return (
    <div className="timing">
      {rows.map((r) => (
        <div key={r.label} className="timing-row">
          <span className="timing-label">{r.label}</span>
          <span className="timing-track"><span className="timing-bar" style={{ width: `${((r.ms as number) / total) * 100}%` }} /></span>
          <span className="timing-ms">{r.ms} ms</span>
        </div>
      ))}
    </div>
  );
}
