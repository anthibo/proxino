# -*- mode: python ; coding: utf-8 -*-
"""One-file build of the Proxino backend (mitmdump + addon + built web UI).

Run via desktop/sidecar/build.py, which sets the cwd to the repo root.
"""
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

ROOT = Path.cwd()
assert (ROOT / "pyproject.toml").exists(), "run from the repo root"
assert (ROOT / "web" / "dist" / "index.html").exists(), "build the web UI first"

platform_pkgs = {
    "darwin": ["mitmproxy_macos"],
    "win32": ["mitmproxy_windows"],
    "linux": ["mitmproxy_linux"],
}.get(sys.platform, [])

hidden = (
    collect_submodules("mitmproxy")
    + collect_submodules("proxino")
    + ["mitmproxy_rs", "certifi", "uvicorn.logging", "uvicorn.loops.auto",
       "uvicorn.protocols.http.auto", "uvicorn.protocols.websockets.auto",
       "uvicorn.lifespan.on"]
    + platform_pkgs
)

datas = (
    [(str(ROOT / "web" / "dist"), "web/dist"),
     (str(ROOT / "proxino" / "addon.py"), "proxino")]
    + collect_data_files("mitmproxy")
    + collect_data_files("certifi")
)

a = Analysis(
    [str(ROOT / "desktop" / "sidecar" / "entry.py")],
    pathex=[str(ROOT)],
    hiddenimports=hidden,
    datas=datas,
    excludes=["tkinter", "tcl", "tk", "IPython", "matplotlib"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas,
    name="proxino-backend",
    console=True,
    upx=False,
    strip=False,
)
