import { useEffect, useState } from "react";
import { useStore } from "../store";
import { toCurl } from "../curl";
import { replay } from "../api";
import { clockTime } from "../format";
import { JsonView } from "./JsonView";
import { Timing } from "./Timing";
import { ReplayModal } from "./ReplayModal";
import { WsMessages } from "./WsMessages";

type Tab = "overview" | "headers" | "body" | "messages" | "timing";

function requestContentType(headers: [string, string][]): string | undefined {
  const h = headers.find(([k]) => k.toLowerCase() === "content-type");
  return h?.[1];
}

function wsFramesLine(ws: NonNullable<import("../types").FlowMeta["ws"]>): string {
  if (ws.open) return `${ws.messages} · open`;
  if (ws.closed_by) return `${ws.messages} · closed by ${ws.closed_by}${ws.close_code != null ? ` (${ws.close_code})` : ""}`;
  return `${ws.messages}`;
}

export function DetailPane({ width }: { width?: number } = {}) {
  const detail = useStore((s) => s.detail);
  // The detail body/headers/etc. come from the one-shot fetch at selection
  // time, but the ws summary (open/messages/closed_by) keeps changing while
  // a socket is live -- pull it from the live flow map so the Overview line
  // and the Messages tab's reachability track flow.update events instead of
  // freezing at whatever `detail` looked like when the row was selected.
  const liveMeta = useStore((s) => (s.selectedId ? s.flows.get(s.selectedId) : undefined));
  const meta = liveMeta ?? detail ?? undefined;
  const isWs = meta?.kind === "ws";
  const ws = meta?.ws;
  const [tab, setTab] = useState<Tab>("body");
  const [replayOpen, setReplayOpen] = useState(false);
  useEffect(() => {
    setTab(isWs ? "messages" : "body");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);
  const style = width != null ? { width } : undefined;
  if (!detail) return <div className="detail empty" style={style}>Select a request</div>;
  const r = detail.response;
  const tabs: Tab[] = isWs ? ["overview", "headers", "messages", "timing"] : ["overview", "headers", "body", "timing"];
  return (
    <div className="detail" style={style}>
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
        {!isWs && (
          <button className="chip primary" onClick={() => replay(detail.id).catch(() => {})}>
            <span className="play-ico">▶</span> Replay
          </button>
        )}
        {!isWs && <button className="chip" onClick={() => setReplayOpen(true)}>Edit &amp; Resend</button>}
        <button className="chip" onClick={() => navigator.clipboard.writeText(toCurl(detail))}>Copy as cURL</button>
      </div>
      {replayOpen && <ReplayModal detail={detail} onClose={() => setReplayOpen(false)} />}
      <div className="detail-tabs">
        {tabs.map((t) => (
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
          {isWs && ws && (
            <div className="gen-row"><span className="gk">Frames</span><span className="gv mono">{wsFramesLine(ws)}</span></div>
          )}
        </div>
      )}
      {tab === "headers" && (
        <div className="detail-headers">
          {[...detail.request.headers, ...(r?.headers ?? [])].map(([k, v], i) => (
            <div key={i} className="hrow"><span className="hkey">{k}</span>: <span className="hval">{v}</span></div>
          ))}
        </div>
      )}
      {tab === "body" && (
        <div className="body-tab">
          {(detail.request.body || (detail.request.body == null && detail.request.size > 0)) && (
            <>
              <div className="body-tab-req">
                <JsonView
                  label="REQUEST BODY"
                  body={detail.request.body}
                  contentType={requestContentType(detail.request.headers)}
                  view={detail.request.body_view}
                  pretty={detail.request.body_pretty}
                  size={detail.request.size}
                />
              </div>
              <div className="body-divider" />
            </>
          )}
          <div className="body-tab-resp">
            <JsonView
              label="RESPONSE BODY"
              body={r?.body ?? null}
              contentType={r?.content_type}
              status={r?.status}
              reason={r?.reason}
              view={r?.body_view}
              pretty={r?.body_pretty}
              size={r?.size}
            />
          </div>
        </div>
      )}
      {tab === "messages" && <WsMessages key={detail.id} flowId={detail.id} />}
      {tab === "timing" && <Timing timing={detail.timing} />}
    </div>
  );
}
