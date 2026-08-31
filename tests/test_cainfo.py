from pathlib import Path
from proxino.cainfo import ca_info

_PEM = """-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z
-----END CERTIFICATE-----
"""

def test_missing_ca(tmp_path):
    info = ca_info(tmp_path / "nope.pem")
    assert info == {"present": False, "fingerprint_sha256": None, "cert_url": "http://mitm.it"}

def test_present_ca_returns_fingerprint(tmp_path):
    p = tmp_path / "ca.pem"; p.write_text(_PEM)
    info = ca_info(p)
    assert info["present"] is True
    assert info["cert_url"] == "http://mitm.it"
    # fingerprint is a hex sha256 of the file bytes, formatted with colons
    assert info["fingerprint_sha256"] and ":" in info["fingerprint_sha256"]
