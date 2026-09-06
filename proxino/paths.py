"""Locate bundled assets across the three ways Proxino runs.

dev checkout:      <repo>/web/dist, <repo>/proxino/addon.py
PyPI wheel:        <site-packages>/proxino/web_dist, .../proxino/addon.py
PyInstaller:       sys._MEIPASS/web/dist, sys._MEIPASS/proxino/addon.py
"""
from __future__ import annotations
import sys
from pathlib import Path

_PKG_DIR = Path(__file__).resolve().parent


def _meipass() -> Path | None:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return None


def web_dist() -> Path | None:
    """Directory holding the built web UI (has index.html), or None."""
    candidates: list[Path] = []
    if (m := _meipass()) is not None:
        candidates.append(m / "web" / "dist")
    candidates.append(_PKG_DIR.parent / "web" / "dist")
    candidates.append(_PKG_DIR / "web_dist")
    for c in candidates:
        if (c / "index.html").is_file():
            return c
    return None


def addon_path() -> Path:
    """Path to addon.py to hand to mitmdump -s."""
    if (m := _meipass()) is not None:
        return m / "proxino" / "addon.py"
    return _PKG_DIR / "addon.py"
