import { useState } from "react";
import { classify, collapsedLabel } from "../json/summary";

function parse(body: string | null): { ok: boolean; value?: unknown } {
  if (body == null) return { ok: false };
  try { return { ok: true, value: JSON.parse(body) }; } catch { return { ok: false }; }
}

function Leaf({ value }: { value: unknown }) {
  const t = classify(value);
  const text = t === "string" ? `"${value as string}"` : String(value);
  return <span className={`jv-${t}`}>{text}</span>;
}

function Node({ k, value, depth, collapseSignal }: { k?: string; value: unknown; depth: number; collapseSignal: number }) {
  const t = classify(value);
  const container = t === "object" || t === "array";
  const [open, setOpen] = useState(true);
  const [sig, setSig] = useState(collapseSignal);
  if (sig !== collapseSignal) { setSig(collapseSignal); if (container) setOpen(false); }
  const pad = { paddingLeft: depth * 16 };
  const keyEl = k !== undefined ? <><span className="jv-key">{`"${k}"`}</span><span className="jv-punct">: </span></> : null;

  if (!container) {
    return <div className="jv-row" style={pad}>{keyEl}<Leaf value={value} /></div>;
  }
  const entries: [string | number, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [i, v]) : Object.entries(value as object);
  const openTok = Array.isArray(value) ? "[" : "{";
  const closeTok = Array.isArray(value) ? "]" : "}";
  return (
    <div>
      <div className="jv-row jv-toggle" style={pad} onClick={() => setOpen((o) => !o)}>
        {keyEl}
        {open ? <span className="jv-punct">{openTok}</span>
              : <span className="jv-collapsed">{collapsedLabel(value)}</span>}
      </div>
      {open && entries.map(([ck, cv]) => (
        <Node key={String(ck)} k={Array.isArray(value) ? undefined : String(ck)} value={cv} depth={depth + 1} collapseSignal={collapseSignal} />
      ))}
      {open && <div className="jv-row" style={{ paddingLeft: depth * 16 }}><span className="jv-punct">{closeTok}</span></div>}
    </div>
  );
}

// Tokenize a line of markup into tag/text spans for lightweight highlighting.
function markupTokens(line: string) {
  const out: { tag: boolean; v: string }[] = [];
  const re = /<\/?[a-zA-Z!?][^>]*>/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ tag: false, v: line.slice(last, m.index) });
    out.push({ tag: true, v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ tag: false, v: line.slice(last) });
  return out.length ? out : [{ tag: false, v: line }];
}

function RawLines({ text, markup }: { text: string; markup?: boolean }) {
  const lines = text.split("\n");
  return (
    <div className="jv-raw-wrap">
      <div className="jv-gutter">{lines.map((_, i) => <div key={i}>{i + 1}</div>)}</div>
      <pre className="jv-raw">
        {lines.map((ln, i) => (
          <div key={i} className="jv-line">
            {markup
              ? markupTokens(ln).map((tok, j) => <span key={j} className={tok.tag ? "jv-tag" : undefined}>{tok.v}</span>)
              : (ln || "​")}
          </div>
        ))}
      </pre>
    </div>
  );
}

type Mode = "pretty" | "raw" | "preview";

export function JsonView({ body, contentType, status, reason }:
  { body: string | null; contentType?: string; status?: number; reason?: string }) {
  const [mode, setMode] = useState<Mode>("pretty");
  const [collapseSignal, setCollapseSignal] = useState(0);
  const parsed = parse(body);
  const ct = (contentType ?? "").toLowerCase();
  const isJson = parsed.ok && (ct.includes("json") || ct === "");
  const isMarkup = ct.includes("html") || ct.includes("xml");
  const canPreview = ct.includes("html") && body != null;
  const isError = status != null && status >= 400;
  const effMode: Mode = mode === "preview" && !canPreview ? "pretty" : mode;
  const prettyJson = isJson ? JSON.stringify(parsed.value, null, 2) : "";

  return (
    <div className="jsonview">
      <div className="jv-toolbar">
        <span className="jv-label">RESPONSE BODY</span>
        {contentType && <span className="jv-ct">{contentType.split(";")[0]}</span>}
        <span className="jv-tbspace" />
        <div className="seg">
          <button className={"seg-item" + (effMode === "pretty" ? " active" : "")} onClick={() => setMode("pretty")}>Pretty</button>
          <button className={"seg-item" + (effMode === "raw" ? " active" : "")} onClick={() => setMode("raw")}>Raw</button>
          {canPreview && <button className={"seg-item" + (effMode === "preview" ? " active" : "")} onClick={() => setMode("preview")}>Preview</button>}
        </div>
        {isJson && effMode === "pretty" && <button className="chip" onClick={() => setCollapseSignal((s) => s + 1)}>Collapse all</button>}
        <button className="chip" onClick={() => body && navigator.clipboard.writeText(body)}>Copy</button>
      </div>
      {isError && <div className="jv-errbanner">⚠ {status} {reason || "Error response"}</div>}
      {body == null ? (
        <pre className="jv-raw jv-empty">(no body)</pre>
      ) : effMode === "preview" ? (
        <iframe className="jv-preview" sandbox="" srcDoc={body} title="Response preview" />
      ) : isJson && effMode === "pretty" ? (
        <div className="jv-tree"><Node value={parsed.value} depth={0} collapseSignal={collapseSignal} /></div>
      ) : (
        <RawLines text={isJson ? prettyJson : body} markup={isMarkup} />
      )}
    </div>
  );
}
