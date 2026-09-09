import { useMemo, useState } from "react";
import type { FlowDetail } from "../types";
import { replayEdited } from "../api";
import { HeaderRowsEditor, type Row } from "./HeaderRowsEditor";

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
function editedCurl(method: string, url: string, headers: [string, string][], body: string): string {
  const parts = [`curl -X ${method} ${shq(url)}`];
  for (const [k, v] of headers) parts.push(`-H ${shq(`${k}: ${v}`)}`);
  if (body) parts.push(`--data-raw ${shq(body)}`);
  return parts.join(" \\\n  ");
}

/** Edit & resend: tweak method/URL/headers/body, then replay as a new flow. */
export function ReplayModal({ detail, onClose }: { detail: FlowDetail; onClose: () => void }) {
  const url0 = `${detail.scheme}://${detail.host}${detail.path}${detail.query ? "?" + detail.query : ""}`;
  const [method, setMethod] = useState(detail.method);
  const [url, setUrl] = useState(url0);
  const [rows, setRows] = useState<Row[]>(() =>
    detail.request.headers.map(([key, val]) => ({ on: true, key, val })));
  const [body, setBody] = useState(detail.request.body ?? "");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const headers = useMemo<[string, string][]>(
    () => rows.filter((r) => r.on && r.key).map((r) => [r.key, r.val]), [rows]);

  const send = async () => {
    setStatus("sending");
    try {
      await replayEdited(detail.id, { method, url, headers, body: body || null });
      setStatus("sent");
      setTimeout(onClose, 700);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal replay-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit &amp; resend</h2>
        <div className="rp-line">
          <select className="rp-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input className="rp-url" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
        </div>

        <div className="rp-section">Headers</div>
        <HeaderRowsEditor rows={rows} onChange={setRows} />

        <div className="rp-section">Body</div>
        <textarea className="rp-body" value={body} placeholder="(no body)"
                  onChange={(e) => setBody(e.target.value)} spellCheck={false} />

        <div className="rp-actions">
          <button className="chip" onClick={() => navigator.clipboard.writeText(editedCurl(method, url, headers, body))}>Copy as cURL</button>
          <span className="rp-spacer" />
          {status === "error" && <span className="rp-err">Send failed</span>}
          {status === "sent" && <span className="rp-ok">Sent ✓</span>}
          <button className="chip" onClick={onClose}>Cancel</button>
          <button className="chip primary" disabled={status === "sending"} onClick={send}>
            {status === "sending" ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
