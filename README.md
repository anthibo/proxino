# Proxino

**A free, open-source HTTP inspector for your apps.** Point a phone, emulator, browser, script, or your own machine at Proxino and watch its HTTPS traffic live — requests, responses, timings, grouped per client — with filters, a JSON/HTML viewer, replay, edit-and-resend, and breakpoints. A self-hosted alternative to Proxyman and Charles: no account, no license, runs entirely on your machine.

**Landing page:** [anthibo.github.io/proxino](https://anthibo.github.io/proxino/)

<p align="center"><img src="https://raw.githubusercontent.com/anthibo/proxino/main/docs/media/hero.png" alt="Proxino inspector showing captured iPhone traffic with a JSON response open" width="900"></p>

<p align="center"><img src="https://raw.githubusercontent.com/anthibo/proxino/main/docs/media/demo.gif" alt="Filtering, opening a request, viewing headers and timing, and edit-and-resend" width="900"></p>

> ⚠️ **It's a man-in-the-middle tool by design.** Use it only on devices and traffic you own or are authorized to inspect. The web UI binds to `127.0.0.1` only.

---

## Install

### Desktop app (recommended)

Download from the [latest release](https://github.com/anthibo/proxino/releases/latest):

| Platform | File | First launch |
|---|---|---|
| macOS 12+ (Apple Silicon; Intel is on the [roadmap](#roadmap)) | `Proxino_<version>_aarch64.dmg` | Unsigned build: right-click **Proxino.app → Open**, or `xattr -dr com.apple.quarantine /Applications/Proxino.app` |
| Windows 10/11 (x64) | `Proxino_<version>_x64-setup.exe` | SmartScreen → **More info → Run anyway** |
| Linux (x64) | `Proxino_<version>_amd64.AppImage` or `Proxino_<version>_amd64.deb` | AppImage: `chmod +x Proxino_*.AppImage && ./Proxino_*.AppImage` |

The app bundles the capture engine — no Python or Node needed. It uses port 8080 for the proxy and 8081 for the UI, falling back to free ports if those are taken (the Connect-device wizard always shows the real one).

### Web UI via pip (coming soon)

The PyPI package isn't published yet — it will be `pipx install proxino` once a release lands there. Until then, use the desktop app above or run from source below.

### From source

```bash
git clone https://github.com/anthibo/proxino && cd proxino
python3 -m venv .venv && .venv/bin/pip install -e .
cd web && npm install && npm run build && cd ..
.venv/bin/proxino
```

`proxino --proxy-port 9090 --web-port 9091` changes the ports; any other flag is passed to `mitmdump`.

---

## Why Proxino instead of Proxyman / Charles?

The commercial inspectors are excellent tools, and if you need map-local or scripting today they still do more. Proxino is for the case where you want something **free, open, and self-hosted** that treats every client as first-class:

- **Free and MIT-licensed** — no account, no license key, no trial timer.
- **Open source** — a mitmproxy addon, a FastAPI backend, and a React UI you can read and change.
- **Runs where you work** — native desktop app for macOS (Apple Silicon), Windows, and Linux, or the same UI in any browser when run from source (PyPI package coming soon).
- **Any client** — phones, emulators, browsers, scripts, and your own machine are auto-named from their traffic and grouped in the sidebar; phones get a connect wizard with a scannable CA QR code.
- **Intercept built in** — pause, edit, and resend requests or responses with breakpoints. Still missing map-local and scripting. See the [roadmap](#roadmap).

---

## Features

- **Live capture** of HTTP/HTTPS flows, streamed to the browser over WebSocket.
- **WebSocket frames** — each connection is a live row; the Messages tab streams frames with direction, size, and JSON/MsgPack/Protobuf previews.
- **Breakpoints** — pause matching requests or responses, edit headers, body, status, then continue or drop; rules live in the Breakpoints dialog and `~/.proxino/config.json`; a paused flow auto-continues after 60 s and nothing pauses while no UI is connected.
- **Per‑device grouping** — clients are auto‑named from the User‑Agent (iPhone, Android app, Mac…) with per‑device request counts; rename any device inline.
- **Filter DSL** — `status:>=400 host:*.example.com path:/v2/*`, plus `type:ws` for WebSocket flows, with autocomplete, quick method chips (All/GET/POST/4xx/5xx), an "Errors only" toggle, and saved filters.
- **Rich response viewer** — collapsible syntax‑highlighted JSON, HTML/XML highlighting with a rendered Preview, line numbers, content‑type badge, and an error banner for 4xx/5xx — and decoded views for Protobuf/gRPC (schema-less), MsgPack, multipart and form bodies; request bodies shown alongside responses.
- **Detail pane** — Overview (client, remote address, protocol/TLS, timing), Headers, Body, and a Timing waterfall.
- **Replay & Edit‑and‑Resend** — one‑click replay of a captured request, or open the editor to tweak method/URL/headers/body and send it as a new flow.
- **Copy as cURL**, **HAR export**, and **session save/load** (Proxino JSON).
- **Connect‑device wizard** with the proxy address and a scannable QR code for the CA certificate.

---

## How it works

```
        ┌────────────┐        ┌──────────────────────────────┐
 phone  │  mitmproxy  │  flows │  Proxino addon                │
 ───────▶  (:8080)     ├────────▶  • in‑memory flow store       │
 HTTPS  │  TLS decrypt │        │  • ClientRegistry (devices)   │
        └────────────┘        │  • FastAPI app  (:8081)        │
                              │      REST + WebSocket           │
                              │      serves web/dist            │
                              └───────────────┬───────────────┘
                                              │ HTTP/WS
                                     ┌────────▼────────┐
                                     │  React web UI    │  http://127.0.0.1:8081
                                     └─────────────────┘
```

- **`proxino/`** — the mitmproxy addon (`addon.py`), flow model + store, client/device registry, the FastAPI server (`server.py`), and helpers: TLS passthrough for pinned hosts (`passthrough.py`), breakpoints (`breakpoints.py`), WebSocket frames (`wsstore.py`), body decoders (`decode.py`), HAR, sessions, CA info, transform.
- **`web/`** — the Vite + React + TypeScript UI (Zustand store, filter DSL, JSON viewer, etc.).

See [`docs/architecture.md`](https://github.com/anthibo/proxino/blob/main/docs/architecture.md) for a deeper tour.

---

## Connecting a device

1. Put the phone on the **same Wi‑Fi** as this machine.
2. Set a **manual HTTP proxy** to this machine's LAN IP, port **8080**
   (the Connect‑device wizard in the UI shows the exact address).
   - **iOS:** Settings → Wi‑Fi → (i) → Configure Proxy → Manual
   - **Android:** Wi‑Fi → long‑press network → Modify → Proxy → Manual
3. **Install and trust the CA** so HTTPS can be decrypted:
   - Open **http://mitm.it** on the device (through the proxy) and install the cert.
   - **iOS also needs:** Settings → General → About → **Certificate Trust Settings** → enable full trust. *(This step is easy to miss and is the usual cause of "no requests show up".)*

Some apps pin certificates (Instagram, Facebook, the iOS App Store/iCloud) and will refuse the proxy's cert every time — without this, they'd simply stop working while the phone is proxied. After two refusals Proxino passes that host through encrypted so the app keeps working, and lists it under **Passthrough** in the sidebar. You can retry decryption for a host from there once it stops pinning, or pre‑list known hosts under `"passthrough_hosts"` in `~/.proxino/config.json` to skip the two failed attempts.

---

## Inspecting this computer

Proxino also captures traffic from the machine it runs on — a browser, a script, a CLI. The proxy is at `127.0.0.1:8080`, so point the system proxy at **loopback**, not the LAN IP.

- **macOS:** System Settings → Network → your service → Details → Proxies → enable **Web Proxy** and **Secure Web Proxy**, both `127.0.0.1` port `8080`. Trust the CA once: double‑click `~/.mitmproxy/mitmproxy-ca-cert.pem` in Keychain Access and set it to **Always Trust**.
- **Windows:** Settings → Network → Proxy → Manual, `127.0.0.1:8080`. Import the CA into **Trusted Root Certification Authorities**.
- **Linux / a single tool:** set `HTTP_PROXY`/`HTTPS_PROXY` to `http://127.0.0.1:8080` for that process, and point it at the CA (many tools honour `SSL_CERT_FILE` / `REQUESTS_CA_BUNDLE`).

Turn the system proxy back **off** when Proxino isn't running, or the machine loses internet. Apple's own system services and cert‑pinned desktop apps won't decrypt — passthrough handles those the same way it does on a phone.

---

## Breakpoints

Open **Breakpoints** in the top bar to add a rule matching a host, path, method, and phase (request or response). When a request or response matches, it pauses in a **Paused** group at the top of the table — select it to open the inline editor and modify headers, body, or status. Press ⌘↵ to **Continue** or ⌘⌫ to **Drop** the paused flow; if no action is taken within 60 s, it auto-continues. Nothing pauses while no UI client is connected.

---

## Development

```bash
# Backend tests
.venv/bin/python -m pytest

# Frontend unit tests + type‑check
cd web && npm test && npx tsc --noEmit

# End‑to‑end (Playwright, against a mock server)
cd web && npx playwright test

# Live‑reloading UI (proxy the dev server's API/WS to :8081)
cd web && npm run dev
```

Project layout:

```
proxino/        mitmproxy addon + FastAPI backend (Python)
web/            React + TypeScript web UI (Vite)
tests/          backend tests (pytest)
web/tests/      frontend unit tests (vitest)
web/e2e/        end‑to‑end tests (Playwright)
docs/           documentation
```

---

## Configuration

| What            | Default            | Notes                                            |
|-----------------|--------------------|--------------------------------------------------|
| Proxy port      | `8080`             | `--proxy-port <n>`                               |
| Web UI port     | `8081`             | `--web-port <n>` (loopback only)                 |
| Max flows       | `5000` in memory   | oldest evicted first                             |
| CA certificate  | `~/.mitmproxy/`    | generated by mitmproxy on first run              |

**Desktop app:** the window has no native title bar — drag it by the top bar to move it, and double-click the top bar to maximize.

---

## Roadmap

- Map-local / mock responses, client-side scripting hooks
- Find-in-body search, copy-all-as-cURL
- PyPI package (`pipx install proxino`)
- Signed and notarized desktop builds, Intel macOS build, Homebrew tap

Ideas and PRs welcome — see [CONTRIBUTING.md](https://github.com/anthibo/proxino/blob/main/CONTRIBUTING.md).

---

## License

[MIT](https://github.com/anthibo/proxino/blob/main/LICENSE) © Abdulrahman Khalid
