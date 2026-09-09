import { useState } from "react";
import type { BreakpointRule, Breakpoints } from "../types";
import { saveBreakpoints } from "../api";
import { useStore } from "../store";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PHASES: BreakpointRule["phase"][] = ["request", "response", "both"];

const newRule = (): BreakpointRule => ({
  id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
  enabled: true, host: "", path: "", method: "", phase: "both",
});

const invalid = (r: BreakpointRule) => !(r.host || r.path || r.method);

/** Edit breakpoint rules: pause matching requests/responses for manual inspection. */
export function BreakpointsModal({ onClose }: { onClose: () => void }) {
  const stored = useStore((s) => s.breakpoints);
  const setBreakpoints = useStore((s) => s.setBreakpoints);
  const [draft, setDraft] = useState<Breakpoints>(stored);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patchRule = (i: number, p: Partial<BreakpointRule>) =>
    setDraft((d) => ({ ...d, rules: d.rules.map((r, j) => (j === i ? { ...r, ...p } : r)) }));
  const addRule = () => setDraft((d) => ({ ...d, rules: [...d.rules, newRule()] }));
  const removeRule = (i: number) => setDraft((d) => ({ ...d, rules: d.rules.filter((_, j) => j !== i) }));

  const handleSave = async () => {
    if (draft.rules.some(invalid)) {
      setError("Set a host, path or method for every rule.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await saveBreakpoints(draft);
      setBreakpoints(result);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal bp-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Breakpoints</h2>
        <label className="bp-enabled">
          <input
            type="checkbox"
            aria-label="Breakpoints enabled"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
          Breakpoints enabled
        </label>

        <div className="bp-rules">
          {draft.rules.map((r, i) => (
            <div className="bp-row" key={r.id}>
              <input
                type="checkbox"
                aria-label="Enabled"
                checked={r.enabled}
                onChange={(e) => patchRule(i, { enabled: e.target.checked })}
              />
              <input
                aria-label="Host"
                placeholder="Host (e.g. *.soum.sa)"
                value={r.host}
                onChange={(e) => patchRule(i, { host: e.target.value })}
                spellCheck={false}
              />
              <input
                aria-label="Path"
                placeholder="Path (e.g. /v2/*)"
                value={r.path}
                onChange={(e) => patchRule(i, { path: e.target.value })}
                spellCheck={false}
              />
              <select aria-label="Method" value={r.method} onChange={(e) => patchRule(i, { method: e.target.value })}>
                <option value="">any</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                aria-label="Phase"
                value={r.phase}
                onChange={(e) => patchRule(i, { phase: e.target.value as BreakpointRule["phase"] })}
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button className="bp-del" aria-label={`Delete rule ${i + 1}`} onClick={() => removeRule(i)}>✕</button>
            </div>
          ))}
        </div>

        <button className="bp-add" onClick={addRule}>Add rule</button>
        {error && <div className="bp-error">{error}</div>}

        <div className="bp-actions">
          <span className="bp-spacer" />
          <button className="chip" onClick={onClose}>Cancel</button>
          <button className="chip primary" disabled={saving} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
