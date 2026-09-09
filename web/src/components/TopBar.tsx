import { useEffect, useRef, useState } from "react";
import { clearFlows, download, fetchFlows, loadSession, caInfo, fetchConnectInfo } from "../api";
import { useStore } from "../store";
import { ExportMenu } from "./ExportMenu";
import { Settings } from "./Settings";
import { LockOpenIcon } from "./LockOpenIcon";

const VIEWS: { key: "inspector" | "devices" | "dashboard"; label: string }[] = [
  { key: "inspector", label: "Inspector" },
  { key: "devices", label: "Devices" },
  { key: "dashboard", label: "Dashboard" },
];

export function TopBar({ onConnect }: { onConnect: () => void }) {
  const clear = useStore((s) => s.clear);
  const upsert = useStore((s) => s.upsertFlow);
  const passthroughActiveCount = useStore((s) => s.passthrough.filter((p) => p.active).length);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [proxy, setProxy] = useState<string | null>(null);
  const [caOk, setCaOk] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetchConnectInfo().then((i) => setProxy(i.proxy_hint)).catch(() => {});
    caInfo().then((c) => setCaOk(!!c.present)).catch(() => {});
  }, []);

  const handleSave = () => {
    download("/api/session", "proxino-session.json");
    setMenuOpen(false);
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
    setMenuOpen(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await loadSession(JSON.parse(text));
    const flows = await fetchFlows();
    flows.forEach(upsert);
    // reset input so same file can be re-loaded
    e.target.value = "";
  };

  const handleExportHar = () => {
    download("/api/export/har", "proxino.har");
    setMenuOpen(false);
  };

  const handleClear = async () => {
    try { await clearFlows(); } catch { console.warn("[proxino] clear failed"); }
    clear();
    setMenuOpen(false);
  };

  return (
    <div className="topbar" data-tauri-drag-region="true">
      <div className="topbar-left">
        <span className="brand" data-tauri-drag-region="true">Proxino<span className="beta">BETA</span></span>
        <span className="tb-status"><span className="tb-dot live" />Listening
          <code className="tb-addr">{proxy ?? "…"}</code></span>
        <span className="tb-status"><span className="tb-dot rec" />Recording</span>
        <span className="tb-status">
          <span className={"tb-dot " + (caOk ? "ok" : "off")} />
          {caOk == null ? "CA…" : caOk ? "CA trusted" : "CA not installed"}
        </span>
        {passthroughActiveCount > 0 && (
          <span className="tb-status tb-passthrough"
                title="Hosts whose apps refused the proxy certificate; forwarded encrypted">
            <LockOpenIcon size={13} />{passthroughActiveCount} passthrough
          </span>
        )}
      </div>
      <div className="view-switch" role="tablist">
        {VIEWS.map((v) => (
          <button key={v.key} role="tab" aria-selected={view === v.key}
                  className={"vs-item" + (view === v.key ? " active" : "")}
                  onClick={() => setView(v.key)}>{v.label}</button>
        ))}
      </div>
      <span className="topbar-spacer" />
      <button onClick={onConnect}>Connect device</button>
      <div style={{ position: "relative" }}>
        <button onClick={() => setMenuOpen((o) => !o)}>Export ▾</button>
        {menuOpen && (
          <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 100 }}>
            <ExportMenu
              onSave={handleSave}
              onLoad={handleLoad}
              onExportHar={handleExportHar}
              onClear={handleClear}
            />
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <button onClick={handleClear}>Clear</button>
      <button onClick={() => setShowSettings(true)}>Settings</button>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
