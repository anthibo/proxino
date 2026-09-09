from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel

Header = tuple[str, str]
FlowState = Literal["pending", "complete", "error"]

class ClientRef(BaseModel):
    ip: str
    label: str
    kind: str = "unknown"  # phone | tablet | laptop | desktop | unknown

class Request(BaseModel):
    headers: list[Header] = []
    size: int = 0
    body: Optional[str] = None
    body_view: Optional[str] = None
    body_pretty: Optional[str] = None

class Response(BaseModel):
    status: int
    reason: str = ""
    headers: list[Header] = []
    size: int = 0
    content_type: str = ""
    body: Optional[str] = None
    body_view: Optional[str] = None
    body_pretty: Optional[str] = None

class Timing(BaseModel):
    start: int
    req_done: int | None = None
    resp_start: int | None = None
    resp_done: int | None = None
    duration_ms: int | None = None
    connect_ms: int | None = None
    tls_ms: int | None = None
    ttfb_ms: int | None = None
    download_ms: int | None = None

FlowKind = Literal["http", "ws"]

class WsSummary(BaseModel):
    messages: int = 0
    open: bool = True
    closed_by: Optional[str] = None   # "client" | "server" | None
    close_code: Optional[int] = None
    close_reason: Optional[str] = None

class Flow(BaseModel):
    id: str
    timestamp: int
    client: ClientRef
    method: str
    scheme: str
    host: str
    port: int
    path: str
    query: str = ""
    http_version: str = ""
    server_addr: Optional[str] = None
    tls_version: Optional[str] = None
    request: Request
    response: Optional[Response] = None
    timing: Timing
    state: FlowState = "pending"
    error: Optional[str] = None
    kind: FlowKind = "http"
    ws: Optional[WsSummary] = None

    def meta(self) -> dict:
        d = self.model_dump()
        d["request"].pop("body", None)
        d["request"].pop("body_pretty", None)
        if d["response"] is not None:
            d["response"].pop("body", None)
            d["response"].pop("body_pretty", None)
        d["duration_ms"] = self.timing.duration_ms
        return d
