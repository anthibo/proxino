import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { PausedEntry } from "../types";
import { resumePaused, dropPaused } from "../api";
import { HeaderRowsEditor, type Row } from "./HeaderRowsEditor";
import { useStore } from "../store";

const remainingSecs = (entry: PausedEntry) => Math.max(0, Math.ceil(entry.deadline - Date.now() / 1000));

/** Inline editor for a request/response paused at a breakpoint: edit and continue, continue
 *  unchanged, or drop -- with a countdown to the server-side auto-continue deadline. */
export function PausedEditor({ entry }: { entry: PausedEntry }) {
  const removePaused = useStore((s) => s.removePaused);
  const { flow } = entry;
  const isReq = entry.phase === "request";

  const url0 = `${flow.scheme}://${flow.host}${flow.path}${flow.query ? "?" + flow.query : ""}`;
  const [method, setMethod] = useState(flow.method);
  const [url, setUrl] = useState(url0);
  const origStatus = flow.response?.status ?? 0;
  const origReason = flow.response?.reason ?? "";
  const [status, setStatusVal] = useState(String(origStatus));
  const [reason, setReason] = useState(origReason);

  const origHeaders = isReq ? flow.request.headers : (flow.response?.headers ?? []);
  const origBody = isReq ? flow.request.body : (flow.response?.body ?? null);
  const [rows, setRows] = useState<Row[]>(() => origHeaders.map(([key, val]) => ({ on: true, key, val })));
  const [body, setBody] = useState(origBody ?? "");

  const [remaining, setRemaining] = useState(() => remainingSecs(entry));
  useEffect(() => {
    const t = setInterval(() => setRemaining(remainingSecs(entry)), 1000);
    return () => clearInterval(t);
  }, [entry]);

  const headers = useMemo<[string, string][]>(
    () => rows.filter((r) => r.on && r.key).map((r) => [r.key, r.val]), [rows]);
  const headersChanged = useMemo(
    () => JSON.stringify(headers) !== JSON.stringify(origHeaders), [headers, origHeaders]);
  const bodyChanged = body !== (origBody ?? "");

  const buildEdits = (): Record<string, unknown> | undefined => {
    const edits: Record<string, unknown> = {};
    if (isReq) {
      if (method !== flow.method) edits.method = method;
      if (url !== url0) edits.url = url;
    } else {
      const n = Number(status);
      if (!Number.isNaN(n) && n !== origStatus) edits.status = n;
      if (reason !== origReason) edits.reason = reason;
    }
    if (headersChanged) edits.headers = headers;
    if (bodyChanged) edits.body = body || null;
    return Object.keys(edits).length ? edits : undefined;
  };

  const doContinue = async () => {
    await resumePaused(entry.flow_id, buildEdits());
    removePaused(entry.flow_id);
  };
  const doContinueUnchanged = async () => {
    await resumePaused(entry.flow_id, undefined);
    removePaused(entry.flow_id);
  };
  const doDrop = async () => {
    await dropPaused(entry.flow_id);
    removePaused(entry.flow_id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "Enter") { e.preventDefault(); doContinue(); }
    else if (e.key === "Backspace") { e.preventDefault(); doDrop(); }
  };

  return (
    <div className="paused-editor" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="pe-head">
        <span className="p-badge">PAUSED</span>
        <span className="pe-title">{isReq ? "Request paused" : "Response paused"}</span>
        {remaining > 0 && <span className="countdown">auto-continues in {remaining}s</span>}
      </div>

      {isReq ? (
        <div className="rp-line">
          <select className="rp-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input className="rp-url" aria-label="URL" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
        </div>
      ) : (
        <div className="rp-line">
          <input className="rp-status" aria-label="Status" value={status} onChange={(e) => setStatusVal(e.target.value)} />
          <input className="rp-reason" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}

      <div className="rp-section">Headers</div>
      <HeaderRowsEditor rows={rows} onChange={setRows} />

      <div className="rp-section">Body</div>
      <textarea className="rp-body" aria-label="Body" value={body} placeholder="(no body)"
                onChange={(e) => setBody(e.target.value)} spellCheck={false} />

      <div className="rp-actions">
        <button className="chip" onClick={doDrop}>Drop</button>
        <span className="rp-spacer" />
        <button className="chip" onClick={doContinueUnchanged}>Continue unchanged</button>
        <button className="chip primary" onClick={doContinue}>Continue</button>
      </div>
    </div>
  );
}
