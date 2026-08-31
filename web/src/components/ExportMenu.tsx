export function ExportMenu(p: {
  onSave: () => void; onLoad: () => void; onExportHar: () => void; onClear: () => void;
}) {
  return (
    <div className="menu">
      <div className="menu-sect">SESSION</div>
      <button className="menu-item" onClick={p.onSave}>Save session…</button>
      <button className="menu-item" onClick={p.onLoad}>Load session…</button>
      <div className="menu-sect">EXPORT</div>
      <button className="menu-item" onClick={p.onExportHar}>Export as HAR</button>
      <button className="menu-item danger" onClick={p.onClear}>Clear session</button>
    </div>
  );
}
