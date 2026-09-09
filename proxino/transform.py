from __future__ import annotations
from mitmproxy.http import HTTPFlow
from .clients import ClientRegistry
from .decode import decode_body
from .models import Flow, Request, Response, Timing, ClientRef

_MAX_BODY = 256 * 1024

def _ms(ts: float | None) -> int | None:
    return int(ts * 1000) if ts is not None else None

def _body(raw: bytes | None) -> str | None:
    if not raw:
        return None
    try:
        raw.decode("utf-8")  # validate the full payload is text, not binary
    except UnicodeDecodeError:
        return None
    return raw[:_MAX_BODY].decode("utf-8", errors="replace")

def _headers(fields) -> list[tuple[str, str]]:
    return [(k, v) for k, v in fields.items(multi=True)]

def flow_to_record(mflow: HTTPFlow, registry: ClientRegistry) -> Flow:
    r = mflow.request
    ip = (mflow.client_conn.peername or ("unknown", 0))[0]
    ua = r.headers.get("user-agent")
    label, kind = registry.device_for(ip, ua)
    path, _, query = r.path.partition("?")
    req_content = r.get_content(strict=False)
    req_content_type = r.headers.get("content-type")
    req_view = decode_body(req_content, req_content_type, r)
    req = Request(headers=_headers(r.headers),
                  size=len(r.raw_content or b""), body=_body(req_content),
                  body_view=req_view[0] if req_view else None,
                  body_pretty=req_view[1] if req_view else None)
    resp = None
    state = "pending"
    if mflow.response is not None:
        rp = mflow.response
        resp_content = rp.get_content(strict=False)
        resp_content_type = rp.headers.get("content-type", "")
        resp_view = decode_body(resp_content, resp_content_type, rp)
        resp = Response(status=rp.status_code, reason=rp.reason or "",
                        headers=_headers(rp.headers),
                        size=len(rp.raw_content or b""),
                        content_type=resp_content_type,
                        body=_body(resp_content),
                        body_view=resp_view[0] if resp_view else None,
                        body_pretty=resp_view[1] if resp_view else None)
        state = "complete"
    if getattr(mflow, "error", None):
        state = "error"
    start = _ms(r.timestamp_start) or 0
    resp_done = _ms(mflow.response.timestamp_end) if mflow.response else None
    req_done = _ms(r.timestamp_end)
    resp_start = _ms(mflow.response.timestamp_start) if mflow.response else None
    ttfb = (resp_start - req_done) if (resp_start is not None and req_done is not None) else None
    download = (resp_done - resp_start) if (resp_done is not None and resp_start is not None) else None
    sc = getattr(mflow, "server_conn", None)
    tcp = _ms(getattr(sc, "timestamp_tcp_setup", None)) if sc else None
    tls = _ms(getattr(sc, "timestamp_tls_setup", None)) if sc else None
    peer = getattr(sc, "peername", None) if sc else None
    server_addr = f"{peer[0]}:{peer[1]}" if peer else None
    tls_version = getattr(sc, "tls_version", None) if sc else None
    connect_ms = (tcp - start) if (tcp is not None) else None
    if connect_ms is not None and connect_ms < 0:
        connect_ms = None
    tls_ms = (tls - tcp) if (tls is not None and tcp is not None) else None
    if tls_ms is not None and tls_ms < 0:
        tls_ms = None
    timing = Timing(start=start, req_done=req_done, resp_start=resp_start,
                    resp_done=resp_done,
                    duration_ms=(resp_done - start) if resp_done is not None else None,
                    connect_ms=connect_ms, tls_ms=tls_ms, ttfb_ms=ttfb, download_ms=download)
    return Flow(
        id=mflow.id, timestamp=start,
        client=ClientRef(ip=ip, label=label, kind=kind),
        method=r.method, scheme=r.scheme, host=r.host, port=r.port,
        path=path, query=query, http_version=r.http_version,
        server_addr=server_addr, tls_version=tls_version,
        request=req, response=resp, timing=timing, state=state,
        error=str(mflow.error) if getattr(mflow, "error", None) else None,
    )
