import { useStore } from "../store";
import { fetchDetail } from "../api";
import { bytes, typeLabel } from "../format";
import type { FlowDetail, FlowMeta } from "../types";

const methodColor: Record<string, string> = {
  GET: "#34D399", POST: "#FBBF24", PUT: "#60A5FA", DELETE: "#F87171", PATCH: "#A78BFA",
};
const statusColor = (s?: number) =>
  !s ? "#626C7E" : s >= 500 ? "#F87171" : s >= 400 ? "#FB923C" : s >= 300 ? "#60A5FA" : "#34D399";

export function FlowTable() {
  const paused = useStore((s) => s.paused);
  const pausedFlows = useStore((s) => s.pausedFlows());
  const rows = useStore((s) => s.visibleFlows()).filter((f) => !(f.id in paused));
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const onClick = async (f: FlowMeta) => select(f.id, await fetchDetail(f.id));
  const onClickPaused = (flow: FlowDetail) => select(flow.id, flow);
  return (
    <div className="flowtable" role="table">
      <div className="flowhead" role="row">
        <span /><span>METHOD</span><span>STATUS</span><span>HOST</span>
        <span>PATH</span><span>TYPE</span><span className="ta-r">SIZE</span><span className="ta-r">TIME</span>
      </div>
      {pausedFlows.length > 0 && (
        <>
          <div className="paused-group-head">Paused ({pausedFlows.length})</div>
          {pausedFlows.map((f) => (
            <div key={f.id} role="row" className={"flowrow" + (f.id === selectedId ? " selected" : "")}
                 onClick={() => onClickPaused(f)}>
              <span className="dot" style={{ background: statusColor(f.response?.status) }} />
              <span className="method" style={{ color: methodColor[f.method] ?? "#E7EAF0" }}>{f.method}</span>
              <span className="status"><span className="p-badge">PAUSED</span></span>
              <span className="host">{f.host}</span>
              <span className="path">{f.path}</span>
              <span className="type">{typeLabel(f.response?.content_type)}</span>
              <span className="size ta-r">{bytes(f.response?.size)}</span>
              <span className="time ta-r">{f.duration_ms != null ? `${f.duration_ms} ms` : ""}</span>
            </div>
          ))}
        </>
      )}
      {rows.length === 0 && pausedFlows.length === 0 ? (
        <div className="empty">Waiting for traffic…</div>
      ) : rows.map((f) => (
        <div key={f.id} role="row" className={"flowrow" + (f.id === selectedId ? " selected" : "")}
             onClick={() => onClick(f)}>
          <span className="dot" style={{ background: statusColor(f.response?.status) }} />
          <span className="method" style={{ color: methodColor[f.method] ?? "#E7EAF0" }}>{f.method}</span>
          <span className="status" style={{ color: statusColor(f.response?.status) }}>{f.response?.status ?? "…"}</span>
          <span className="host">{f.host}</span>
          <span className="path">{f.path}</span>
          {f.kind === "ws" ? (
            <span className="type type-ws">ws{f.ws?.open && <span className="ws-live" />}</span>
          ) : (
            <span className="type">{typeLabel(f.response?.content_type)}</span>
          )}
          <span className="size ta-r">{f.kind === "ws" ? `${f.ws?.messages ?? 0} msgs` : bytes(f.response?.size)}</span>
          <span className="time ta-r">{f.duration_ms != null ? `${f.duration_ms} ms` : ""}</span>
        </div>
      ))}
    </div>
  );
}
