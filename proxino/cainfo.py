from __future__ import annotations
import hashlib
from pathlib import Path

_DEFAULT = Path.home() / ".mitmproxy" / "mitmproxy-ca-cert.pem"

def ca_info(ca_path: Path | None = None) -> dict:
    path = Path(ca_path) if ca_path is not None else _DEFAULT
    if not path.exists():
        return {"present": False, "fingerprint_sha256": None, "cert_url": "http://mitm.it"}
    digest = hashlib.sha256(path.read_bytes()).hexdigest().upper()
    fp = ":".join(digest[i:i+2] for i in range(0, len(digest), 2))
    return {"present": True, "fingerprint_sha256": fp, "cert_url": "http://mitm.it"}
