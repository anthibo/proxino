export type Header = [string, string];
export type FlowState = "pending" | "complete" | "error";
export type DeviceKind = "phone" | "tablet" | "laptop" | "desktop" | "unknown";
export interface ClientRef { ip: string; label: string; kind?: DeviceKind; }
export interface ReqMeta { headers: Header[]; size: number; }
export interface RespMeta { status: number; reason: string; headers: Header[]; size: number; content_type: string; }
export interface TimingDetail {
  start: number;
  req_done: number | null;
  resp_start: number | null;
  resp_done: number | null;
  duration_ms: number | null;
  connect_ms: number | null;
  tls_ms: number | null;
  ttfb_ms: number | null;
  download_ms: number | null;
}
export interface FlowMeta {
  id: string; timestamp: number; client: ClientRef;
  method: string; scheme: string; host: string; port: number;
  path: string; query: string; http_version: string;
  server_addr?: string | null; tls_version?: string | null;
  request: ReqMeta; response: RespMeta | null;
  duration_ms: number | null; state: FlowState; error: string | null;
}
export interface FlowDetail extends FlowMeta {
  request: ReqMeta & { body: string | null };
  response: (RespMeta & { body: string | null }) | null;
  timing: TimingDetail;
}
export interface ClientInfo { ip: string; label: string; count: number; kind?: DeviceKind; }
export interface PassthroughHost {
  host: string; source: "auto" | "config"; active: boolean; failures: number;
  clients: string[]; first_seen: number; last_seen: number;
}
export type WSEvent =
  | { type: "flow.new" | "flow.complete" | "flow.error"; flow: FlowMeta }
  | { type: "client.new"; client: ClientInfo }
  | { type: "passthrough.update"; hosts: PassthroughHost[] };
