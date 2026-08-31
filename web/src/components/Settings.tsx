import { useEffect, useState } from "react";
import { caInfo } from "../api";

export function Settings({ onClose }: { onClose: () => void }) {
  const [ca, setCa] = useState<{ present: boolean; fingerprint_sha256: string | null; cert_url: string } | null>(null);
  useEffect(() => { caInfo().then(setCa).catch(() => {}); }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="set-sect">PROXY</div>
        <div className="set-row"><span>Proxy port</span><code>8080</code></div>
        <div className="set-row"><span>Web UI port</span><code>8081</code></div>
        <div className="set-sect">CERTIFICATE AUTHORITY</div>
        <div className="set-row"><span>{ca?.present ? "Trusted / installed" : "Not installed"}</span>
          <code>{ca?.fingerprint_sha256 ?? "…"}</code></div>
        <a className="set-link" href={ca?.cert_url ?? "http://mitm.it"}>Export CA ({ca?.cert_url ?? "http://mitm.it"})</a>
        <div className="set-sect">CAPTURE</div>
        <div className="set-row"><span>Max flows in memory</span><code>5000</code></div>
        <div className="set-sect">APPEARANCE</div>
        <div className="set-row"><span>Theme</span><code>Dark</code></div>
        <button className="chip primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
