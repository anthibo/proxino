from __future__ import annotations
from typing import Callable
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from .netinfo import lan_ips
from .sessions import dump_session, load_session
from .har import flows_to_har
from .cainfo import ca_info
from proxino.paths import web_dist

class LabelBody(BaseModel):
    label: str

class ReplayEdit(BaseModel):
    method: str | None = None
    url: str | None = None
    headers: list[tuple[str, str]] | None = None
    body: str | None = None

def make_app(store, registry, broadcaster, replayer: Callable[[str], bool] | None = None,
             edited_replayer: Callable[[str, dict], bool] | None = None,
             web_port: int = 8081, proxy_port: int = 8080) -> FastAPI:
    app = FastAPI(title="Proxino")

    @app.get("/api/flows")
    def list_flows() -> list[dict]:
        return store.list_meta()

    @app.get("/api/flows/{flow_id}")
    def get_flow(flow_id: str) -> dict:
        flow = store.get(flow_id)
        if flow is None:
            raise HTTPException(status_code=404, detail="not found")
        d = flow.model_dump()
        d["duration_ms"] = flow.timing.duration_ms
        return d

    @app.delete("/api/flows")
    def clear() -> dict:
        store.clear()
        return {"ok": True}

    @app.get("/api/clients")
    def clients() -> list[dict]:
        counts = store.client_counts()
        return [{"ip": ip, "label": registry.label_for(ip), "count": n,
                 "kind": registry.kind_for(ip)}
                for ip, n in counts.items()]

    @app.put("/api/clients/{ip}")
    def set_label(ip: str, body: LabelBody) -> dict:
        registry.set_label(ip, body.label)
        return {"ip": ip, "label": body.label}

    @app.get("/api/connect-info")
    def connect_info() -> dict:
        ips = lan_ips()
        primary = ips[0] if ips else "127.0.0.1"
        return {"lan_ips": ips, "proxy_port": proxy_port,
                "cert_url": "http://mitm.it",
                "proxy_hint": f"{primary}:{proxy_port}"}

    @app.get("/api/ca-info")
    def ca_info_endpoint() -> dict:
        return ca_info()

    @app.get("/api/session")
    def download_session() -> JSONResponse:
        return JSONResponse(
            dump_session(store),
            headers={"Content-Disposition": "attachment; filename=proxino-session.json"},
        )

    @app.post("/api/session")
    def upload_session(flows: list[dict]) -> dict:
        return {"loaded": load_session(store, flows)}

    @app.get("/api/export/har")
    def export_har() -> JSONResponse:
        flows = [store.get(m["id"]) for m in store.list_meta()]
        return JSONResponse(
            flows_to_har(flows),
            headers={"Content-Disposition": "attachment; filename=proxino.har"},
        )


    @app.post("/api/flows/{flow_id}/replay")
    async def replay(flow_id: str) -> dict:
        if replayer is None:
            raise HTTPException(status_code=503, detail="replay unavailable")
        if not replayer(flow_id):
            raise HTTPException(status_code=404, detail="not found")
        return {"ok": True}

    @app.post("/api/flows/{flow_id}/replay-edited")
    async def replay_edited(flow_id: str, edit: ReplayEdit) -> dict:
        if edited_replayer is None:
            raise HTTPException(status_code=503, detail="replay unavailable")
        edits = {k: v for k, v in edit.model_dump().items() if v is not None}
        if not edited_replayer(flow_id, edits):
            raise HTTPException(status_code=404, detail="not found")
        return {"ok": True}

    @app.websocket("/ws")
    async def ws(sock: WebSocket) -> None:
        await sock.accept()
        await broadcaster.register(sock)
        try:
            while True:
                await sock.receive_text()
        except WebSocketDisconnect:
            broadcaster.unregister(sock)

    dist = web_dist()
    if dist is not None:
        app.mount("/", StaticFiles(directory=dist, html=True), name="static")
    return app
