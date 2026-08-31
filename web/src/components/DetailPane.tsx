import { useState } from "react";
import { useStore } from "../store";
import { toCurl } from "../curl";
import { replay } from "../api";
import { clockTime } from "../format";
import { JsonView } from "./JsonView";
import { Timing } from "./Timing";
import { ReplayModal } from "./ReplayModal";

type Tab = "overview" | "headers" | "body" | "timing";

export function DetailPane() {
  const detail = useStore((s) => s.detail);
  const [tab, setTab] = useState<Tab>("body");
  const [replayOpen, setReplayOpen] = useState(false);
  if (!detail) return <div className="detail empty">Select a request</div>;
  const r = detail.response;
  return (
    <div className="detail">
      <div className="detail-head">
        <span className={"m-badge m-" + detail.method}>{detail.method}</span>
        {r && (
          <span className={"s-badge s-" + (r.status >= 500 ? 5 : r.status >= 400 ? 4 : r.status >= 300 ? 3 : 2)}>
            {r.status} {r.reason}
          </span>
        )}
      </div>
      <div className="detail-url">{detail.scheme}://{detail.host}{detail.path}</div>
      <div className="detail-actions">
        <button className="chip primary" onClick={() => replay(detail.id).catch(() => {})}>
          <span className="play-ico">▶</span> Replay
        </button>
        <button className="chip" onClick={() => setReplayOpen(true)}>Edit &amp; Resend</button>
        <button className="chip" onClick={() => navigator.clipboard.writeText(toCurl(detail))}>Copy as cURL</button>
      </div>
      {replayOpen && <ReplayModal detail={detail} onClose={() => setReplayOpen(false)} />}
      <div className="detail-tabs">
        {(["overview", "headers", "body", "timing"] as Tab[]).map((t) => (
          <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="general">
          <div className="gen-head">GENERAL</div>
          <div className="gen-row"><span className="gk">Client</span><span className="gv">{detail.client.label} · {detail.client.ip}</span></div>
          <div className="gen-row"><span className="gk">Remote</span><span className="gv mono">{detail.server_addr ?? `${detail.host}:${detail.port}`}</span></div>
          <div className="gen-row"><span className="gk">Protocol</span><span className="gv mono">{detail.http_version || "—"}{detail.tls_version ? ` · ${detail.tls_version}` : ""}</span></div>
          <div className="gen-row"><span className="gk">Status</span><span className="gv">{r ? `${r.status} ${r.reason}` : detail.state}</span></div>
          <div className="gen-row"><span className="gk">Started</span><span className="gv mono">{clockTime(detail.timestamp)}</span></div>
          <div className="gen-row"><span className="gk">Duration</span><span className="gv mono">{detail.duration_ms != null ? `${detail.duration_ms} ms` : "—"}</span></div>
        </div>
      )}
      {tab === "headers" && (
        <div className="detail-headers">
          {[...detail.request.headers, ...(r?.headers ?? [])].map(([k, v], i) => (
            <div key={i} className="hrow"><span className="hkey">{k}</span>: <span className="hval">{v}</span></div>
          ))}
        </div>
      )}
      {tab === "body" && <JsonView body={r?.body ?? null} contentType={r?.content_type} status={r?.status} reason={r?.reason} />}
      {tab === "timing" && <Timing timing={detail.timing} />}
    </div>
  );
}
