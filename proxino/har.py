from __future__ import annotations
from datetime import datetime, timezone
from .models import Flow

def _headers(pairs: list[tuple[str, str]]) -> list[dict]:
    return [{"name": k, "value": v} for k, v in pairs]

def _entry(f: Flow) -> dict:
    url = f"{f.scheme}://{f.host}{f.path}" + (f"?{f.query}" if f.query else "")
    started = datetime.fromtimestamp(f.timestamp / 1000, timezone.utc).isoformat()
    resp = f.response
    return {
        "startedDateTime": started,
        "time": f.timing.duration_ms if f.timing.duration_ms is not None else -1,
        "request": {
            "method": f.method, "url": url, "httpVersion": f.http_version,
            "headers": _headers(f.request.headers), "queryString": [],
            "headersSize": -1, "bodySize": f.request.size,
        },
        "response": {
            "status": resp.status if resp else 0,
            "statusText": resp.reason if resp else "",
            "httpVersion": f.http_version,
            "headers": _headers(resp.headers) if resp else [],
            "content": {
                "size": resp.size if resp else 0,
                "mimeType": resp.content_type if resp else "",
                "text": (resp.body or "") if resp else "",
            },
            "headersSize": -1, "bodySize": resp.size if resp else -1,
            "redirectURL": "",
        },
        "cache": {},
        "timings": {"send": 0, "wait": f.timing.duration_ms if f.timing.duration_ms is not None else -1, "receive": 0},
    }

def flows_to_har(flows: list[Flow]) -> dict:
    return {"log": {
        "version": "1.2",
        "creator": {"name": "Proxino", "version": "0.1.0"},
        "entries": [_entry(f) for f in flows],
    }}
