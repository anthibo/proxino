import { useState } from "react";
import { useStore } from "../store";
import { suggest } from "../filters/suggest";
import { listSaved, saveFilter } from "../savedFilters";
import { DslHelp } from "./DslHelp";

const QUICK: { label: string; q: string }[] = [
  { label: "All", q: "" },
  { label: "GET", q: "method:GET" },
  { label: "POST", q: "method:POST" },
  { label: "4xx", q: "status:>=400 status:<=499" },
  { label: "5xx", q: "status:>=500" },
];

export function FilterBar() {
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const [focused, setFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const tokens = query.split(/\s+/).filter(Boolean);
  const suggestions = focused && query ? suggest(query) : [];

  const applySuggestion = (token: string) => {
    const parts = query.split(/\s+/);
    parts[parts.length - 1] = token;
    setQuery(parts.join(" "));
  };
  const removeToken = (i: number) => setQuery(tokens.filter((_, j) => j !== i).join(" "));

  return (
    <div className="filterbar">
      <div className="quick-chips">
        {QUICK.map((qc) => (
          <button key={qc.label}
                  className={"qchip" + (query.trim() === qc.q ? " active" : "")}
                  onClick={() => setQuery(qc.q)}>
            {qc.label}
          </button>
        ))}
      </div>
      <div className="chips">
        {tokens.map((t, i) => (
          <span key={t + i} className="active-chip">{t}<button onClick={() => removeToken(i)}>✕</button></span>
        ))}
      </div>
      <input className="search" placeholder="status:>=400  host:*.soum.sa  path:/v2/*"
             value={query} onChange={(e) => setQuery(e.target.value)}
             onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 120)} />
      {suggestions.length > 0 && (
        <div className="ac-dropdown">
          {suggestions.map((s) => (
            <div key={s.token} className="ac-item" onClick={() => applySuggestion(s.token)}>
              <span className="ac-token">{s.token}</span><span className="ac-desc">{s.desc}</span>
            </div>
          ))}
        </div>
      )}
      <button className="chip" onClick={() => setQuery("status:>=400")}>Errors only</button>
      <button className="chip" onClick={() => setShowSaved((v) => !v)}>Saved</button>
      {showSaved && (
        <div className="saved-menu">
          {listSaved().map((f) => (
            <div key={f.name} className="saved-item" onClick={() => { setQuery(f.query); setShowSaved(false); }}>
              {f.fav ? "★ " : ""}{f.name} <span className="saved-q">{f.query}</span>
            </div>
          ))}
          <button className="saved-add" onClick={() => { const n = window.prompt("Filter name"); if (n) saveFilter(n, query); }}>＋ Save current</button>
        </div>
      )}
      <button className="chip" aria-label="Filter syntax help" onClick={() => setShowHelp((v) => !v)}>?</button>
      {showHelp && <DslHelp />}
    </div>
  );
}
