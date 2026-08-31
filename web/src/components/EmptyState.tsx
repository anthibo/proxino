import { useEffect, useState } from "react";
import { fetchConnectInfo } from "../api";

export function EmptyState({ onConnect }: { onConnect: () => void }) {
  const [proxy, setProxy] = useState<string | null>(null);
  useEffect(() => { fetchConnectInfo().then((i) => setProxy(i.proxy_hint)).catch(() => {}); }, []);
  const steps = [
    ["1", "Set the Wi-Fi proxy", `Point your device at ${proxy ?? "this Mac"}`],
    ["2", "Install the CA cert", "Open mitm.it and trust the Proxino root"],
    ["3", "Use your apps", "HTTPS calls are decrypted and listed here"],
  ];
  return (
    <div className="emptystate">
      <div className="es-center">
        <div className="es-icon">
          <span className="es-bar b1" /><span className="es-bar b2" /><span className="es-bar b3" />
        </div>
        <div className="es-title">Waiting for traffic</div>
        <div className="es-sub">Connect a device to Proxino and start making requests.<br />They’ll appear here live as they happen.</div>
        <button className="chip primary es-cta" onClick={onConnect}>Connect a device</button>
        <div className="es-steps">
          {steps.map((s) => (
            <div key={s[0]} className="es-step">
              <span className="es-badge">{s[0]}</span>
              <div className="es-step-title">{s[1]}</div>
              <div className="es-step-desc">{s[2]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
