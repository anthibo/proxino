export interface Row { on: boolean; key: string; val: string; }

/** Editable list of header rows: toggle, edit, add, remove. Shared by ReplayModal and PausedEditor. */
export function HeaderRowsEditor({ rows, onChange }: { rows: Row[]; onChange: (rows: Row[]) => void }) {
  const patch = (i: number, p: Partial<Row>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const addRow = () => onChange([...rows, { on: true, key: "", val: "" }]);
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="rp-headers">
      {rows.map((r, i) => (
        <div key={i} className={"rp-hrow" + (r.on ? "" : " off")}>
          <input type="checkbox" checked={r.on} onChange={(e) => patch(i, { on: e.target.checked })}
                 aria-label={`include ${r.key}`} />
          <input className="rp-hkey" value={r.key} placeholder="Header" onChange={(e) => patch(i, { key: e.target.value })} spellCheck={false} />
          <input className="rp-hval" value={r.val} placeholder="value" onChange={(e) => patch(i, { val: e.target.value })} spellCheck={false} />
          <button className="rp-hdel" aria-label="remove header" onClick={() => removeRow(i)}>✕</button>
        </div>
      ))}
      <button className="rp-hadd" onClick={addRow}>＋ Add header</button>
    </div>
  );
}
