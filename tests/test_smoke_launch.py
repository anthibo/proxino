import os, socket, subprocess, sys, time, urllib.request
import pytest

def _free(port):
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0

@pytest.mark.skipif(not _free(8081) or not _free(8080), reason="ports busy")
def test_proxino_cli_binds_web_ui(tmp_path):
    env = {**os.environ, "BROWSER": "true"}  # non-blocking no-op browser
    proc = subprocess.Popen([sys.executable, "-m", "proxino.cli"],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        up = False
        for _ in range(40):                    # ~8s
            time.sleep(0.2)
            try:
                if urllib.request.urlopen("http://127.0.0.1:8081/api/flows", timeout=1).getcode() == 200:
                    up = True; break
            except OSError:
                pass
        assert up, "web UI did not bind on 8081 — addon likely failed to load"
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except subprocess.TimeoutExpired: proc.kill()
