# Architecture

Proxino has three layers: a **mitmproxy addon** that captures traffic, a **FastAPI backend** that exposes it, and a **React web UI** that renders it. All three run in one process on `127.0.0.1`; a desktop shell (`desktop/`, Tauri) bundles that process as a native app.

## 1. Capture — the mitmproxy addon (`proxino/addon.py`)

Proxino runs as a standard mitmproxy addon loaded by `mitmdump`. mitmproxy terminates TLS with its own CA and re‑encrypts to the origin, so decrypted flows are available to the addon's hooks.

- On `request` a pending row is streamed (`flow.new`); on `response` / `error` the addon converts the mitmproxy `HTTPFlow` into a plain `Flow` record (`transform.py`) and stores it in an in‑memory ring buffer (`store.py`, capped at 5000, oldest evicted), broadcasting `flow.complete` / `flow.error`.
- Original mitmproxy flow objects are retained (bounded) so **Replay** and **Edit‑and‑Resend** can re‑issue them; the edit logic lives in `apply_request_edits` / `apply_response_edits`.
- When mitmproxy finishes starting (`running` hook), the addon boots the FastAPI app on a uvicorn server bound to `127.0.0.1`, and starts a 1 s breakpoint sweep task.

`cli.py` translates Proxino's own flags (`--proxy-port` / `--web-port`, env `PROXINO_*`) into `mitmdump` argv and always loads the addon. `paths.py` resolves the built UI and the addon across dev, PyPI wheel, and frozen (PyInstaller) layouts.

### TLS passthrough for pinned hosts (`passthrough.py`)

Cert‑pinned apps drop the handshake rather than trust the proxy's cert. The `tls_failed_client` hook feeds a `PassthroughRegistry` that counts failures per SNI host; after two within a minute the host flips to passthrough. The `tls_clienthello` hook then sets `ignore_connection` for that host, so mitmproxy forwards it encrypted and untouched — the app keeps working, no HTTP flow is produced, and the host is surfaced via `passthrough.update`. Known hosts can be pre‑listed under `"passthrough_hosts"` in `~/.proxino/config.json`.

### Breakpoints (`breakpoints.py`)

`BreakpointEngine` matches structured rules (host / path / method / phase, fnmatch globs) and pauses matching flows with `flow.intercept()` in the `request` / `response` hooks — but never for replays and never while no UI client is connected (`Broadcaster.client_count() == 0`), so an armed rule can't strand a device. A paused flow's record carries state `paused_request` / `paused_response`; `resume_paused` applies edits and continues, `drop_paused` kills it. A 1 s sweep auto‑continues anything paused longer than 60 s. Rules live under `"breakpoints"` in `~/.proxino/config.json`.

### WebSocket frames (`wsstore.py`)

The `websocket_start` / `websocket_message` / `websocket_end` hooks mark the flow `kind: "ws"` and append each frame to a per‑connection capped buffer (`WsStore`, 500 frames) with a lightweight text / JSON / MsgPack / Protobuf preview. Frames stream as `ws.message` events; a throttled `flow.update` keeps the row's frame count fresh.

### Body decoders (`decode.py`)

`decode_body` renders Protobuf, gRPC (schema‑less), MsgPack, multipart, and URL‑encoded bodies via mitmproxy's content views, size‑guarded so a large body never stalls the hot hook path. The result is stored on the record as `body_view` (a short label) and `body_pretty`.

### Device detection (`clients.py`)

`ClientRegistry.device_for(ip, user_agent)` returns a `(label, kind)` pair and remembers the first device *kind* seen per IP, recognising browsers and native app HTTP stacks (`CFNetwork`/`Darwin` → iOS app, `okhttp`/`Dalvik` → Android app). Labels, passthrough hosts, and breakpoint rules are persisted atomically to `~/.proxino/config.json` with a read‑modify‑write that preserves the other keys.

## 2. API — the FastAPI backend (`proxino/server.py`)

`make_app(store, registry, broadcaster, ...)` builds the app. Key endpoints:

| Method | Path                              | Purpose                                     |
|--------|-----------------------------------|---------------------------------------------|
| GET    | `/api/flows`                      | flow list (metadata, no bodies)             |
| GET    | `/api/flows/{id}`                 | full flow detail (headers + bodies)         |
| GET    | `/api/flows/{id}/ws`              | WebSocket frames for a `ws` flow (paged)    |
| DELETE | `/api/flows`                      | clear the store                             |
| GET/PUT | `/api/clients` · `/api/clients/{ip}` | per‑device counts + kind · rename       |
| POST   | `/api/flows/{id}/replay` · `/replay-edited` | replay, or replay with edits       |
| GET/DELETE | `/api/passthrough` · `/api/passthrough/{host}` | passed‑through hosts · retry decrypt |
| GET/PUT | `/api/breakpoints`               | breakpoint rules + enabled toggle           |
| GET    | `/api/paused`                     | currently paused flows (with a snapshot)    |
| POST   | `/api/paused/{id}/resume` · `/drop` | continue (with optional edits) · drop     |
| GET    | `/api/export/har`                 | HAR 1.2 export                              |
| GET/POST | `/api/session`                  | save / load a Proxino JSON session          |
| GET    | `/api/connect-info` · `/api/ca-info` | proxy address · CA fingerprint           |
| WS     | `/ws`                             | live event stream                           |

The built web UI (`web/dist`) is mounted at `/` when present. Endpoints that publish (resume, drop, clear) are `async def` so they run on mitmproxy's own asyncio loop — the addon and API share one event loop and one store, so a publish from an HTTP handler reaches the same broadcaster.

**WebSocket events:** `flow.new` / `flow.complete` / `flow.error` / `flow.update`, `ws.message`, `passthrough.update`, and `breakpoint.paused` / `resumed` / `dropped` / `timeout` / `breakpoints.update`.

## 3. UI — the React app (`web/`)

- **State:** a Zustand store (`store.ts`) holds the flow map, selection, active filter/client, and the passthrough / breakpoints / paused / WebSocket‑frame collections. `visibleFlows()` applies the parsed filter + client selection.
- **Live updates:** the WebSocket client in `App.tsx` auto‑reconnects and calls `resync()` (flows, passthrough, breakpoints, paused, and the selected ws flow's frames) on reconnect.
- **Filter DSL:** `filters/dsl.ts` parses queries like `status:>=400 host:*.soum.sa path:/v2/*` (plus `type:ws`) into a predicate; `filters/suggest.ts` powers autocomplete.
- **Viewers:** `JsonView` renders a collapsible, syntax‑highlighted tree plus a line‑numbered raw view, a format badge for decoded bodies, and a sandboxed Preview iframe; `WsMessages` streams WebSocket frames; `Timing` draws the per‑phase waterfall.
- **Components** map to UI regions: `TopBar`, `FilterBar`, `ClientsSidebar`, `FlowTable`, `DetailPane`, `StatusBar`, the `Devices` and `Dashboard` views, and modals (`ConnectDeviceModal`, `ReplayModal`, `Settings`, `BreakpointsModal`); paused flows edit inline via `PausedEditor` (sharing `HeaderRowsEditor` with `ReplayModal`).

## Data model (`proxino/models.py`)

A `Flow` carries request/response metadata, a `ClientRef` (ip, label, kind), `server_addr`, `tls_version`, a `Timing` breakdown (connect / TLS / TTFB / download), a `kind` (`http` / `ws`) with a `ws` summary, and a `modified` flag set when a breakpoint edit was applied. Request/response bodies carry `body_view` / `body_pretty` from the decoders. `Flow.meta()` returns the list‑view projection (bodies stripped) used by `/api/flows` and the WebSocket events.

## Desktop shell (`desktop/`)

A Tauri 2 app bundles the Python backend as a PyInstaller sidecar. On launch it picks free ports (proxy prefers 8080, UI 8081), spawns the sidecar, waits for the UI port, and loads it in a native window, killing the sidecar on exit. Releases are built for macOS, Windows, and Linux by the tag‑triggered `.github/workflows/release.yml`.
