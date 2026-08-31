import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { fetchConnectInfo } from "../api";
import { useStore } from "../store";

type Platform = "ios" | "android";
interface ConnectInfo { proxy_hint: string; cert_url: string; proxy_port?: number; lan_ips?: string[]; }

export function ConnectDeviceModal({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [platform, setPlatform] = useState<Platform>("ios");
  const [qr, setQr] = useState<string | null>(null);
  const flows = useStore((s) => s.flows);

  useEffect(() => { fetchConnectInfo().then(setInfo).catch(() => {}); }, []);
  useEffect(() => {
    if (!info?.cert_url) return;
    QRCode.toDataURL(info.cert_url, { margin: 1, width: 200, color: { dark: "#0E1016", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(null));
  }, [info?.cert_url]);

  // A "device" is any client that isn't this Mac's loopback.
  const devices = useMemo(() => {
    const ips = new Set<string>();
    for (const f of flows.values()) if (f.client.ip !== "127.0.0.1") ips.add(f.client.ip);
    return [...ips];
  }, [flows]);
  const connected = devices.length > 0;

  const [host, port] = (info?.proxy_hint ?? "…:…").split(":");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal connect-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Connect a device</h2>

        <div className="cd-tabs">
          <button className={"cd-tab" + (platform === "ios" ? " active" : "")} onClick={() => setPlatform("ios")}>iOS</button>
          <button className={"cd-tab" + (platform === "android" ? " active" : "")} onClick={() => setPlatform("android")}>Android</button>
        </div>

        <div className="cd-body">
          <div className="cd-steps">
            <ol>
              <li>Join the same Wi-Fi network as this Mac.</li>
              {platform === "ios" ? (
                <li>Settings → Wi-Fi → tap <b>ⓘ</b> → Configure Proxy → <b>Manual</b>.</li>
              ) : (
                <li>Wi-Fi → long-press your network → Modify → Proxy → <b>Manual</b>.</li>
              )}
              <li>
                Enter the proxy:
                <div className="cd-proxy">
                  <div className="cd-field"><span>Server</span><code>{host}</code></div>
                  <div className="cd-field"><span>Port</span><code>{port}</code></div>
                </div>
              </li>
              <li>
                Open <a href={info?.cert_url}>{info?.cert_url ?? "…"}</a> (or scan the code) and install the Proxino CA.
              </li>
              {platform === "ios" ? (
                <li>Settings → General → About → Certificate Trust Settings → enable full trust for Proxino.</li>
              ) : (
                <li>Settings → Security → Install a certificate → CA certificate → pick the downloaded file.</li>
              )}
            </ol>
          </div>

          <div className="cd-qr">
            {qr ? <img src={qr} alt="Certificate URL QR code" width={160} height={160} /> : <div className="cd-qr-ph" />}
            <div className="cd-qr-cap">Scan to install the CA</div>
          </div>
        </div>

        <div className={"cd-status" + (connected ? " ok" : "")}>
          <span className="cd-dot" />
          {connected
            ? <span>Device connected — {devices.join(", ")}</span>
            : <span>Waiting for the first request from a new device…</span>}
        </div>

        <div className="cd-actions">
          <button className="chip primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
