"""Build the PyInstaller sidecar and place it where Tauri expects it.

Usage: python desktop/sidecar/build.py [--skip-web]
Requires: a Python 3.12 interpreter (uses `uv` if available), Node, Rust (for
the target triple), and network access for pip.
Output: desktop/src-tauri/binaries/proxino-backend-<triple>[.exe]
"""
from __future__ import annotations
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIDECAR = ROOT / "desktop" / "sidecar"
BIN_DIR = ROOT / "desktop" / "src-tauri" / "binaries"


def run(cmd: list[str], **kw) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def target_triple() -> str:
    out = subprocess.run(["rustc", "-vV"], check=True, capture_output=True, text=True).stdout
    for line in out.splitlines():
        if line.startswith("host:"):
            return line.split(":", 1)[1].strip()
    raise SystemExit("rustc -vV did not report a host triple")


def python312_cmd() -> list[str]:
    """Resolve a command that invokes a real Python 3.12 interpreter, for the
    non-uv fallback. `sys.executable` is only used when it is itself 3.12 --
    it must never silently pin whatever Python happens to run this script."""
    if os.name == "nt":
        if shutil.which("py"):
            return ["py", "-3.12"]
    else:
        exe = shutil.which("python3.12")
        if exe:
            return [exe]
    if sys.version_info[:2] == (3, 12):
        return [sys.executable]
    raise SystemExit("Python 3.12 is required to build the sidecar (install uv or python3.12)")


def build_python() -> Path:
    """Return a python executable inside a 3.12 env with proxino[desktop] installed."""
    venv = SIDECAR / ".venv"
    py = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    has_uv = shutil.which("uv") is not None
    if not py.exists():
        if has_uv:
            # --seed ensures pip is installed into the venv; modern uv
            # (>=0.6ish) does not seed pip by default, and we also use
            # uv pip install below which does not need it -- but --seed
            # keeps `py` itself a normal, pip-capable interpreter.
            run(["uv", "venv", "--seed", "--python", "3.12", str(venv)])
        else:
            run([*python312_cmd(), "-m", "venv", str(venv)])
    if has_uv:
        # Use uv for the installs too, so nothing here depends on pip
        # actually being present inside the venv.
        run(["uv", "pip", "install", "--python", str(py), "-q", f"{ROOT}[desktop]"])
    else:
        run([str(py), "-m", "pip", "install", "--upgrade", "pip", "-q"])
        run([str(py), "-m", "pip", "install", "-q", f"{ROOT}[desktop]"])
    return py


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-web", action="store_true", help="reuse existing web/dist")
    args = ap.parse_args()

    if not args.skip_web:
        npm = "npm.cmd" if os.name == "nt" else "npm"
        run([npm, "ci"], cwd=ROOT / "web")
        run([npm, "run", "build"], cwd=ROOT / "web")

    py = build_python()
    run([str(py), "-m", "PyInstaller", "--noconfirm", "--clean",
         "--distpath", str(SIDECAR / "dist"), "--workpath", str(SIDECAR / "build"),
         str(SIDECAR / "proxino-backend.spec")], cwd=ROOT)

    ext = ".exe" if os.name == "nt" else ""
    built = SIDECAR / "dist" / f"proxino-backend{ext}"
    BIN_DIR.mkdir(parents=True, exist_ok=True)
    dest = BIN_DIR / f"proxino-backend-{target_triple()}{ext}"
    shutil.copy2(built, dest)
    if ext == "":
        dest.chmod(0o755)
    print("sidecar ->", dest, f"({dest.stat().st_size // 1_000_000} MB)")


if __name__ == "__main__":
    main()
