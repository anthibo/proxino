"""Launch a built sidecar on free ports and check /api/connect-info answers.

Usage: python desktop/sidecar/smoke.py path/to/proxino-backend[-triple]
Exit 0 on success; prints the sidecar's output on failure.
"""
from __future__ import annotations
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _stop(proc: subprocess.Popen) -> None:
    """Terminate the sidecar. PyInstaller's onefile bootloader forwards
    SIGTERM to the child it forks to run the actual interpreter, but a
    SIGKILL never reaches that child and leaks an orphaned process holding
    the port -- so try SIGTERM first and only escalate to SIGKILL if the
    process ignores it."""
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def main(binary: str) -> int:
    proxy, web = free_port(), free_port()
    env = {**os.environ, "PROXINO_NO_BROWSER": "1"}
    proc = subprocess.Popen([binary, "--proxy-port", str(proxy), "--web-port", str(web)],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        deadline = time.time() + 60
        while time.time() < deadline:
            if proc.poll() is not None:
                print(proc.stdout.read()); return 1
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{web}/api/connect-info", timeout=1) as r:
                    info = json.load(r)
                assert info["proxy_port"] == proxy, info
                with urllib.request.urlopen(f"http://127.0.0.1:{web}/", timeout=1) as r:
                    assert b"<!doctype html>" in r.read(2048).lower(), "web UI not served"
                print("sidecar OK:", info); return 0
            except (OSError, AssertionError):
                time.sleep(0.5)
        print("timed out waiting for the sidecar"); _stop(proc); print(proc.stdout.read()); return 1
    finally:
        if proc.poll() is None:
            _stop(proc)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
