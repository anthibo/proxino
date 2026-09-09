from mitmproxy.flow import Error
from mitmproxy.test import tflow, tutils
from proxino.transform import flow_to_record
from proxino.clients import ClientRegistry

def test_transform_basic(tmp_path):
    reg = ClientRegistry(tmp_path / "c.json")
    req = tutils.treq(method=b"GET", host=b"api.soum.sa", port=443,
                      path=b"/v2/x?page=1", scheme=b"https")
    resp = tutils.tresp(status_code=200, content=b'{"ok":true}')
    mf = tflow.tflow(req=req, resp=resp)
    mf.client_conn.peername = ("192.168.1.23", 55123)
    rec = flow_to_record(mf, reg)
    assert rec.method == "GET"
    assert rec.host == "api.soum.sa"
    assert rec.path == "/v2/x"
    assert rec.query == "page=1"
    assert rec.client.ip == "192.168.1.23"
    assert rec.response.status == 200
    assert rec.response.body == '{"ok":true}'
    assert rec.state == "complete"

def test_transform_decodes_gzip_response_body(tmp_path):
    reg = ClientRegistry(tmp_path / "c.json")
    resp = tutils.tresp(status_code=200, content=b'{"ok":true}')
    resp.encode("gzip")   # compress body + set Content-Encoding: gzip
    assert resp.raw_content != b'{"ok":true}'   # sanity: wire bytes are compressed
    mf = tflow.tflow(req=tutils.treq(), resp=resp)
    rec = flow_to_record(mf, reg)
    assert rec.response.body == '{"ok":true}'          # decoded, not garbled
    assert rec.response.size == len(resp.raw_content)   # size stays wire (compressed) bytes

def test_transform_populates_device_kind_and_server_fields(tmp_path):
    reg = ClientRegistry(tmp_path / "c.json")
    req = tutils.treq(host=b"api.soum.sa", port=443, scheme=b"https",
                      headers=((b"user-agent", b"okhttp/4.12.0"),))
    mf = tflow.tflow(req=req, resp=tutils.tresp(status_code=200))
    mf.client_conn.peername = ("192.168.1.29", 5000)
    mf.server_conn.peername = ("104.18.32.7", 443)
    mf.server_conn.tls_version = "TLSv1.3"
    rec = flow_to_record(mf, reg)
    assert rec.client.kind == "phone"
    assert rec.client.label == "Android app"
    assert rec.server_addr == "104.18.32.7:443"
    assert rec.tls_version == "TLSv1.3"
    assert rec.meta()["server_addr"] == "104.18.32.7:443"   # exposed on the list too

def test_transform_pending_when_no_response(tmp_path):
    reg = ClientRegistry(tmp_path / "c.json")
    mf = tflow.tflow(req=tutils.treq())
    mf.response = None
    assert flow_to_record(mf, reg).state == "pending"

def test_transform_error_overrides_complete(tmp_path):
    reg = ClientRegistry(tmp_path / "c.json")
    resp = tutils.tresp(status_code=200, content=b'{"ok":true}')
    mf = tflow.tflow(req=tutils.treq(), resp=resp)
    mf.error = Error("boom")
    rec = flow_to_record(mf, reg)
    assert rec.state == "error"
    assert isinstance(rec.error, str) and rec.error

def test_timing_phases_populated(tmp_path):
    from proxino.clients import ClientRegistry
    from proxino.transform import flow_to_record
    from mitmproxy.test import tflow, tutils
    reg = ClientRegistry(tmp_path / "c.json")
    mf = tflow.tflow(req=tutils.treq(), resp=tutils.tresp())
    rec = flow_to_record(mf, reg)
    assert rec.timing.ttfb_ms is None or isinstance(rec.timing.ttfb_ms, int)
    assert rec.timing.download_ms is None or isinstance(rec.timing.download_ms, int)
    # connect/tls are optional and default to None when unavailable
    assert rec.timing.connect_ms is None or isinstance(rec.timing.connect_ms, int)

def test_negative_connect_phase_is_none(tmp_path, monkeypatch):
    from proxino.clients import ClientRegistry
    from proxino.transform import flow_to_record
    from mitmproxy.test import tflow, tutils
    reg = ClientRegistry(tmp_path / "c.json")
    mf = tflow.tflow(req=tutils.treq(), resp=tutils.tresp())
    # server_conn tcp setup BEFORE the request start → negative connect
    mf.server_conn.timestamp_tcp_setup = mf.request.timestamp_start - 5
    rec = flow_to_record(mf, reg)
    assert rec.timing.connect_ms is None    # negative guarded to None

def test_transform_binary_body_is_none_not_mojibake(tmp_path):
    reg = ClientRegistry(tmp_path / "c.json")
    # invalid utf-8 bytes (lone continuation byte + high bytes) — a real binary payload
    binary = b"\xff\xfe\x00\x01\x02\x03\x80\x81"
    resp = tutils.tresp(status_code=200, content=binary,
                        headers=((b"content-type", b"application/octet-stream"),))
    mf = tflow.tflow(req=tutils.treq(), resp=resp)
    rec = flow_to_record(mf, reg)
    assert rec.response.body is None
    assert rec.response.size == len(binary)

def test_transform_decodes_protobuf_response_body(tmp_path):
    reg = ClientRegistry(tmp_path / "c.json")
    resp = tutils.tresp(status_code=200, content=b"\x08\x96\x01",
                        headers=((b"content-type", b"application/x-protobuf"),))
    mf = tflow.tflow(req=tutils.treq(), resp=resp)
    rec = flow_to_record(mf, reg)
    assert rec.response.body_view == "protobuf"
    assert rec.response.body_pretty
    assert "150" in rec.response.body_pretty
    meta = rec.meta()
    assert "body_pretty" not in meta["response"]
    assert meta["response"]["body_view"] == "protobuf"

from mitmproxy.websocket import WebSocketData
from proxino.transform import flow_to_record
from proxino.clients import ClientRegistry

def test_ws_flow_gets_kind_and_summary(tmp_path):
    f = tflow.tflow(resp=True)
    f.websocket = WebSocketData()
    rec = flow_to_record(f, ClientRegistry(tmp_path / "c.json"))
    assert rec.kind == "ws" and rec.ws is not None and rec.ws.open is True and rec.ws.messages == 0

def test_closed_ws_summary(tmp_path):
    f = tflow.tflow(resp=True)
    f.websocket = WebSocketData(closed_by_client=False, close_code=1000, close_reason="bye", timestamp_end=5.0)
    rec = flow_to_record(f, ClientRegistry(tmp_path / "c.json"))
    assert rec.ws.open is False and rec.ws.closed_by == "server" and rec.ws.close_code == 1000
