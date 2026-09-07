# Proxino desktop

A Tauri 2 shell around the Proxino backend. It ships the backend as a
PyInstaller "sidecar" (`src-tauri/binaries/proxino-backend-<triple>`), picks
free ports (proxy prefers 8080, web UI 8081), spawns the sidecar, waits for the
web port, and loads the UI in a native window. The sidecar is killed on quit.

## Build locally (macOS/Linux/Windows)

Prereqs: Node 22, Rust stable, Python 3.12 (`uv` recommended), plus the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
python desktop/sidecar/build.py           # builds web/dist + the sidecar binary
python desktop/sidecar/smoke.py desktop/src-tauri/binaries/proxino-backend-*   # optional
cd desktop && npm ci && npm run tauri build -- --bundles dmg     # or nsis / appimage deb
```

Installers land in `desktop/src-tauri/target/release/bundle/`.

## Dev loop

`npm run tauri dev` uses the same sidecar; rebuild it after backend changes.

Cold start of the one-file sidecar is about 9 s on Apple Silicon
(measured in Task 5).

## Releases

Built unsigned on GitHub Actions by `.github/workflows/release.yml` on `v*`
tags. See the root README "Install" section for the Gatekeeper/SmartScreen
notes.
