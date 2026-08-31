# Proxino

**A self-hosted network inspector for your phone.** Point an iOS or Android device at Proxino and watch its HTTPS traffic in a live web UI — requests, responses, timings, grouped per device — with filters, a JSON/HTML viewer, replay, and edit‑and‑resend.

Think of it as an open, hackable alternative to Proxyman/Charles: a [mitmproxy](https://mitmproxy.org) addon for capture, a FastAPI backend for the API + live stream, and a React/TypeScript web app for the UI.

> ⚠️ **It's a man‑in‑the‑middle tool by design.** Use it only on devices and traffic you own or are authorized to inspect. The web UI binds to `127.0.0.1` only.

---

## Features

- **Live capture** of HTTP/HTTPS flows, streamed to the browser over WebSocket.
- **Per‑device grouping** — clients are auto‑named from the User‑Agent (iPhone, Android app, Mac…) with per‑device request counts; rename any device inline.
- **Filter DSL** — `status:>=400 host:*.example.com path:/v2/*`, with autocomplete, quick method chips (All/GET/POST/4xx/5xx), an "Errors only" toggle, and saved filters.
- **Rich response viewer** — collapsible syntax‑highlighted JSON, HTML/XML highlighting with a rendered Preview, line numbers, content‑type badge, and an error banner for 4xx/5xx.
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

- **`proxino/`** — the mitmproxy addon (`addon.py`), flow model + store, client/device registry, the FastAPI server (`server.py`), and helpers (HAR, sessions, CA info, transform).
- **`web/`** — the Vite + React + TypeScript UI (Zustand store, filter DSL, JSON viewer, etc.).

See [`docs/architecture.md`](docs/architecture.md) for a deeper tour.

---

## Quick start

**Prerequisites:** Python 3.11+ and Node 18+.

```bash
# 1. Backend (in a virtualenv)
python3 -m venv .venv
.venv/bin/pip install -e .

# 2. Build the web UI (the server serves web/dist)
cd web && npm install && npm run build && cd ..

# 3. Run — starts the proxy on :8080 and the web UI on :8081
.venv/bin/proxino
```

Then open **http://127.0.0.1:8081** and connect a device (below).

> Run `proxino` with **no extra arguments** — that's how it auto‑loads the addon and picks the ports. It's a foreground process; keep it running in its own terminal.

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

Some apps use certificate pinning and will refuse the proxy's cert — those show up as `Client TLS handshake failed` in the log and can't be decrypted. That's expected.

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
| Proxy port      | `8080`             | where devices point                              |
| Web UI port     | `8081`             | `--set proxino_web_port=<n>` (loopback only)     |
| Max flows       | `5000` in memory   | oldest evicted first                             |
| CA certificate  | `~/.mitmproxy/`    | generated by mitmproxy on first run              |

---

## License

[MIT](LICENSE) © Abdulrahman Khalid
