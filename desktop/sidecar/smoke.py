"""Launch a built sidecar on free ports and check /api/connect-info answers.

Usage: python desktop/sidecar/smoke.py path/to/proxino-backend[-triple]
Exit 0 on success; prints the sidecar's output on failure.
"""
from __future__ import annotations
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _popen_kwargs() -> dict:
    """Spawn options that make the whole process tree killable as a group.
    PyInstaller's onefile bootloader forks a child that runs the actual
    interpreter; without these, stopping just the parent can orphan it."""
    if os.name == "nt":
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def _stop(proc: subprocess.Popen) -> None:
    """Kill the sidecar's whole process tree on every platform.

    On Windows, Popen.kill() is just an alias for terminate() and neither
    reaches a forked child. On POSIX, a bare SIGKILL to the PyInstaller
    onefile bootloader kills it before it can forward anything to the child
    it forked, orphaning that child (and the port it holds). So: on Windows,
    `taskkill /T` to kill the whole tree; on POSIX, signal the whole process
    group (started via start_new_session=True) -- SIGTERM first, then
    SIGKILL if it doesn't exit. An already-exited child is not an error.
    """
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        return
    try:
        pgid = os.getpgid(proc.pid)
        os.killpg(pgid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(pgid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass


def _collect_output(proc: subprocess.Popen) -> str:
    """Read whatever output the sidecar produced. Uses a bounded
    communicate() rather than proc.stdout.read(), which can block forever
    if an orphaned child is still holding the pipe's write end open."""
    try:
        out, _ = proc.communicate(timeout=10)
        return out or ""
    except subprocess.TimeoutExpired:
        return "(could not collect sidecar output: read timed out)"


def main(binary: str) -> int:
    proxy, web = free_port(), free_port()
    env = {**os.environ, "PROXINO_NO_BROWSER": "1"}
    proc = subprocess.Popen([binary, "--proxy-port", str(proxy), "--web-port", str(web)],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                            **_popen_kwargs())
    try:
        deadline = time.time() + 60
        while time.time() < deadline:
            if proc.poll() is not None:
                print(_collect_output(proc)); return 1
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{web}/api/connect-info", timeout=1) as r:
                    info = json.load(r)
                assert info["proxy_port"] == proxy, info
                with urllib.request.urlopen(f"http://127.0.0.1:{web}/", timeout=1) as r:
                    assert b"<!doctype html>" in r.read(2048).lower(), "web UI not served"
                print("sidecar OK:", info); return 0
            except (OSError, AssertionError):
                time.sleep(0.5)
        print("timed out waiting for the sidecar")
        _stop(proc)
        print(_collect_output(proc))
        return 1
    finally:
        _stop(proc)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python desktop/sidecar/smoke.py path/to/proxino-backend[-triple]")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
