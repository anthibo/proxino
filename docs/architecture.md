# Architecture

Proxino has three layers: a **mitmproxy addon** that captures traffic, a **FastAPI backend** that exposes it, and a **React web UI** that renders it.

## 1. Capture — the mitmproxy addon (`proxino/addon.py`)

Proxino runs as a standard mitmproxy addon loaded by `mitmdump`. mitmproxy terminates TLS with its own CA and re‑encrypts to the origin, so decrypted HTTP flows are available to the addon's hooks.

- On `response` / `error`, the addon converts the mitmproxy `HTTPFlow` into a plain `Flow` record (`transform.py`) and stores it in an in‑memory ring buffer (`store.py`, capped at 5000, oldest evicted).
- Each flow is also broadcast as a WebSocket event (`flow.new` / `flow.complete` / `flow.error`) via the `Broadcaster`.
- The original mitmproxy flow objects are retained (bounded) so **Replay** and **Edit‑and‑Resend** can re‑issue them through `replay.client`.
- When mitmproxy finishes starting (`running` hook), the addon boots the FastAPI app on a uvicorn server bound to `127.0.0.1`.

`cli.py` is a thin wrapper: bare `proxino` injects `-s addon.py -p 8080` into `mitmdump`'s argv.

### Device detection (`clients.py`)

`ClientRegistry.device_for(ip, user_agent)` returns a `(label, kind)` pair and remembers the first device *kind* seen per IP. It recognises browsers and native app HTTP stacks (`CFNetwork`/`Darwin` → iOS app, `okhttp`/`Dalvik` → Android app), so app traffic resolves to a real device name instead of a bare IP. Labels can be overridden and are persisted atomically to `~/.proxino/config.json`.

## 2. API — the FastAPI backend (`proxino/server.py`)

`make_app(store, registry, broadcaster, ...)` builds the app. Key endpoints:

| Method | Path                              | Purpose                                   |
|--------|-----------------------------------|-------------------------------------------|
| GET    | `/api/flows`                      | flow list (metadata, no bodies)           |
| GET    | `/api/flows/{id}`                 | full flow detail (headers + bodies)       |
| DELETE | `/api/flows`                      | clear the store                           |
| GET    | `/api/clients`                    | per‑device counts + kind                  |
| PUT    | `/api/clients/{ip}`               | rename a device                           |
| POST   | `/api/flows/{id}/replay`          | replay the original request               |
| POST   | `/api/flows/{id}/replay-edited`   | replay with edited method/url/headers/body|
| GET    | `/api/export/har`                 | HAR 1.2 export                            |
| GET/POST | `/api/session`                  | save / load a Proxino JSON session        |
| GET    | `/api/connect-info`, `/api/ca-info` | proxy address, CA fingerprint           |
| WS     | `/ws`                             | live flow stream                          |

The built web UI (`web/dist`) is mounted at `/` when present. Replay endpoints run on mitmproxy's own asyncio loop via injected callables, so the addon and API share one event loop and one store.

## 3. UI — the React app (`web/`)

- **State:** a small Zustand store holds the flow map, selection, and the active filter/client. `visibleFlows()` applies the parsed filter + client selection.
- **Live updates:** `ws.ts` maintains the WebSocket with auto‑reconnect and a resync on reconnect.
- **Filter DSL:** `filters/dsl.ts` parses queries like `status:>=400 host:*.soum.sa path:/v2/*` into a predicate; `filters/suggest.ts` powers autocomplete.
- **Viewers:** `JsonView` renders a collapsible, syntax‑highlighted tree for JSON and a line‑numbered raw view with lightweight HTML/XML highlighting + a sandboxed Preview iframe; `Timing` draws the per‑phase waterfall.
- **Components** map 1:1 to UI regions: `TopBar`, `FilterBar`, `ClientsSidebar`, `FlowTable`, `DetailPane`, `StatusBar`, plus modals (`ConnectDeviceModal`, `ReplayModal`, `Settings`).

## Data model (`proxino/models.py`)

A `Flow` carries request/response metadata, a `ClientRef` (ip, label, kind), `server_addr`, `tls_version`, and a `Timing` breakdown (connect / TLS / TTFB / download). `Flow.meta()` returns the list‑view projection (bodies stripped) used by `/api/flows` and the WebSocket events.
