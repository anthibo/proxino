from __future__ import annotations
import sys
from pathlib import Path

def main() -> None:
    from mitmproxy.tools.main import mitmdump
    addon = str(Path(__file__).resolve().parent / "addon.py")
    if len(sys.argv) == 1:
        sys.argv += ["-s", addon, "-p", "8080"]
    mitmdump()

if __name__ == "__main__":
    main()
