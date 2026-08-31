import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const flow = { id: "e1", timestamp: 1, client: { ip: "192.168.1.23", label: "iPhone" },
  method: "GET", scheme: "https", host: "api.soum.sa", port: 443, path: "/v2/listings",
  query: "", http_version: "HTTP/2", request: { headers: [], size: 0 },
  response: { status: 200, reason: "OK", headers: [], size: 3, content_type: "application/json", body: '{"ok":true}' },
  duration_ms: 142, state: "complete", error: null };
const meta = { ...flow, request: { headers: [], size: 0 }, response: { ...flow.response } };
delete meta.response.body;

const server = createServer((req, res) => {
  const send = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
  if (req.url === "/api/flows") return send([meta]);
  if (req.url === "/api/flows/e1" && req.method === "GET") return send(flow);
  if (req.url === "/api/flows/e1/replay" && req.method === "POST") return send({ ok: true });
  if (req.url === "/api/session" && req.method === "GET") return send([flow]);
  if (req.url === "/api/session" && req.method === "POST") return send({ loaded: 1 });
  if (req.url === "/api/clients") return send([{ ip: "192.168.1.23", label: "iPhone", count: 1 }]);
  if (req.url === "/api/connect-info") return send({ lan_ips: ["192.168.1.10"], proxy_port: 8080, cert_url: "http://mitm.it", proxy_hint: "192.168.1.10:8080" });
  const urlPath = req.url.split("?")[0];
  const path = urlPath === "/" ? "index.html" : urlPath.slice(1);
  const ext = path.split(".").pop();
  const mime = { js: "application/javascript", css: "text/css", html: "text/html", json: "application/json" }[ext] ?? "application/octet-stream";
  if (existsSync(dist + path)) { res.setHeader("content-type", mime); res.end(readFileSync(dist + path)); return; }
  res.statusCode = 404; res.end("nf");
});
new WebSocketServer({ server, path: "/ws" }).on("connection", (ws) => ws.send(JSON.stringify({ type: "flow.complete", flow: meta })));
server.listen(8099, () => console.log("mock on 8099"));
