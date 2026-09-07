"""Send a realistic mix of requests through a local Proxino proxy.

Usage: python scripts/demo_traffic.py [proxy_host:port] [--loop]
Uses an iOS-app User-Agent so the client shows up as an iPhone app.
"""
from __future__ import annotations
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROXY = next((a for a in sys.argv[1:] if not a.startswith("--")), "127.0.0.1:8080")
LOOP = "--loop" in sys.argv
CA = Path.home() / ".mitmproxy" / "mitmproxy-ca-cert.pem"
UA = "SoumApp/3.2.1 (iPhone; iOS 18.4) CFNetwork/1568.200.51 Darwin/24.4.0"

URLS = [
    ("GET", "https://jsonplaceholder.typicode.com/posts?_limit=5", None),
    ("GET", "https://jsonplaceholder.typicode.com/users/1", None),
    ("POST", "https://jsonplaceholder.typicode.com/posts", b'{"title":"hello","body":"from proxino","userId":7}'),
    ("GET", "https://api.github.com/repos/anthibo/proxino", None),
    ("GET", "https://httpbin.org/status/404", None),
    ("GET", "https://httpbin.org/status/500", None),
    ("GET", "https://httpbin.org/delay/1", None),
    ("GET", "https://jsonplaceholder.typicode.com/comments?postId=1", None),
]

ctx = ssl.create_default_context(cafile=str(CA)) if CA.exists() else ssl._create_unverified_context()
opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({"http": f"http://{PROXY}", "https": f"http://{PROXY}"}),
    urllib.request.HTTPSHandler(context=ctx),
)

def hit(method: str, url: str, body: bytes | None) -> None:
    req = urllib.request.Request(url, data=body, method=method,
                                 headers={"User-Agent": UA, "Accept": "application/json",
                                          "Content-Type": "application/json", "X-Session": "demo-4f2a"})
    try:
        with opener.open(req, timeout=15) as r:
            print(method, url, r.status)
    except urllib.error.HTTPError as e:
        print(method, url, e.code)
    except Exception as e:  # network hiccups shouldn't stop the demo
        print(method, url, "ERR", e)

while True:
    for m, u, b in URLS:
        hit(m, u, b); time.sleep(0.6)
    if not LOOP:
        break
