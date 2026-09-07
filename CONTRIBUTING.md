# Contributing to Proxino

Thanks for your interest! Proxino is a mitmproxy addon + FastAPI backend + React/TypeScript UI. Contributions of all sizes are welcome.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cd web && npm install && cd ..
```

## Running

```bash
cd web && npm run build && cd ..   # build the UI the server serves
.venv/bin/proxino                  # proxy :8080, web UI :8081
```

For UI work, run the Vite dev server (`cd web && npm run dev`) alongside the backend.

## Tests — please keep them green

```bash
.venv/bin/python -m pytest          # backend
cd web && npm test && npx tsc --noEmit   # frontend unit + types
cd web && npx playwright test       # end-to-end
```

CI runs all three on every pull request.

## Guidelines

- **Write a test** for new behavior. Backend tests live in `tests/`, frontend unit tests in `web/tests/`, and end-to-end tests in `web/e2e/`.
- **Follow the surrounding style** — match the existing patterns, naming, and formatting in the file you're editing.
- **Keep changes focused.** One logical change per pull request is easiest to review.
- **UI colors and fonts** come from the CSS variables in `web/src/theme.css`; reuse them rather than hardcoding values.

See [`docs/architecture.md`](docs/architecture.md) for how the pieces fit together.

## Reporting issues

Include what you expected, what happened, and (for capture problems) the relevant lines from the `mitmdump` log. Please don't include real personal traffic or secrets in screenshots.

## Releasing

1. Bump `version` in `pyproject.toml`, `desktop/src-tauri/tauri.conf.json`, and `desktop/src-tauri/Cargo.toml` (keep them identical) and commit.
2. `git tag vX.Y.Z && git push origin vX.Y.Z`. The **Release** workflow runs tests, builds the
   sidecar + desktop bundles on macOS/Windows/Linux, builds the wheel, publishes to PyPI, and
   opens a **draft** GitHub Release with checksums.
3. Download the macOS DMG from the draft, install and launch it, capture one request, quit.
4. Publish the draft.

PyPI uses [trusted publishing](https://docs.pypi.org/trusted-publishers/): on PyPI, add a
publisher for `anthibo/proxino`, workflow `release.yml`, environment `pypi`. Until that
exists the `pypi` job fails while the rest of the release still completes.

Builds are unsigned. Adding signing later means adding secrets and the Tauri
`APPLE_*` / `TAURI_SIGNING_*` env vars to the `desktop` job — nothing else changes.
