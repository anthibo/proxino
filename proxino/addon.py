from __future__ import annotations
import asyncio
import logging
import time
from collections import OrderedDict
from pathlib import Path
from mitmproxy import ctx
from mitmproxy.addonmanager import Loader
from mitmproxy.http import HTTPFlow, Headers
from proxino.store import FlowStore
from proxino.clients import ClientRegistry
from proxino.broadcaster import Broadcaster
from proxino.transform import flow_to_record
from proxino.passthrough import PassthroughRegistry
from proxino.wsstore import WsStore
from proxino.breakpoints import BreakpointEngine

_log = logging.getLogger("proxino")


def apply_request_edits(mflow, edits: dict) -> bool:
    """Apply method/url/headers/body edits to mflow.request. Returns True if anything changed."""
    req = mflow.request
    changed = False
    if edits.get("method"):
        req.method = edits["method"]; changed = True
    if edits.get("url"):
        req.url = edits["url"]; changed = True
    if edits.get("headers") is not None:
        req.headers = Headers([(k.encode("utf-8"), v.encode("utf-8")) for k, v in edits["headers"]])
        changed = True
    if "body" in edits and edits["body"] is not None:
        req.content = edits["body"].encode("utf-8"); changed = True
    return changed


def apply_response_edits(mflow, edits: dict) -> bool:
    """Apply status/reason/headers/body edits to mflow.response. Returns True if anything changed."""
    resp = mflow.response
    changed = False
    if resp is None:
        return False
    if edits.get("status"):
        resp.status_code = int(edits["status"]); changed = True
    if edits.get("reason") is not None:
        resp.reason = edits["reason"]; changed = True
    if edits.get("headers") is not None:
        resp.headers = Headers([(k.encode("utf-8"), v.encode("utf-8")) for k, v in edits["headers"]])
        changed = True
    if "body" in edits and edits["body"] is not None:
        resp.content = edits["body"].encode("utf-8"); changed = True
    return changed

class Proxino:
    def __init__(self) -> None:
        self.store = FlowStore()
        self.registry = ClientRegistry(Path.home() / ".proxino" / "config.json")
        self.broadcaster = Broadcaster()
        self.passthrough = PassthroughRegistry(patterns=self.registry.passthrough_patterns())
        self._mflows: OrderedDict[str, HTTPFlow] = OrderedDict()
        self._mflow_cap = 5000
        self.wsstore = WsStore()
        self._ws_throttle: dict[str, float] = {}
        self._ws_now = time.monotonic
        # Wrapped in a lambda (not passed as `self.registry.breakpoints`
        # directly) so that re-pointing `self.registry` or monkeypatching
        # `registry.breakpoints` on an existing instance -- as the tests do
        # -- is honored; a captured bound method would freeze to whatever
        # `breakpoints` resolved to at this line and ignore later rebinding.
        self.breakpoints = BreakpointEngine(lambda: self.registry.breakpoints())
        self._modified: set[str] = set()

    def load(self, loader: Loader) -> None:
        loader.add_option("proxino_web_port", int, 8081, "Proxino web UI port")

    async def running(self) -> None:
        import os, uvicorn, webbrowser
        from proxino.server import make_app
        port = ctx.options.proxino_web_port
        proxy_port = ctx.options.listen_port or 8080
        app = make_app(self.store, self.registry, self.broadcaster,
                       replayer=self.replay, edited_replayer=self.replay_edited,
                       passthrough=self.passthrough,
                       wsstore=self.wsstore,
                       on_clear=self.clear,
                       web_port=port, proxy_port=proxy_port)
        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
        asyncio.ensure_future(uvicorn.Server(config).serve())
        asyncio.ensure_future(self._sweep_loop())
        # The desktop shell hosts the UI in its own window, so it sets this
        # to suppress the browser tab the CLI opens.
        if not os.environ.get("PROXINO_NO_BROWSER"):
            webbrowser.open(f"http://127.0.0.1:{port}")

    def _publish(self, evt: dict) -> None:
        fut = asyncio.ensure_future(self.broadcaster.publish(evt))
        fut.add_done_callback(
            lambda f: f.exception() and _log.error("proxino publish failed: %r", f.exception())
        )

    def _record(self, flow, state: str | None = None):
        rec = flow_to_record(flow, self.registry)
        if state:
            rec.state = state
        if flow.id in self._modified:
            rec.modified = True
        self.store.add(rec)
        return rec

    def _retain(self, flow: HTTPFlow) -> None:
        self._mflows[flow.id] = flow
        self._mflows.move_to_end(flow.id)
        while len(self._mflows) > self._mflow_cap:
            old_id, _ = self._mflows.popitem(last=False)
            self.wsstore.evict(old_id)
            self._ws_throttle.pop(old_id, None)
            self._modified.discard(old_id)

    def clear(self) -> None:
        self.store.clear()
        self._modified.clear()

    def _emit(self, evt_type: str, flow: HTTPFlow) -> None:
        rec = self._record(flow)
        self._retain(flow)
        self._publish({"type": evt_type, "flow": rec.meta()})

    def tls_clienthello(self, data) -> None:
        # A hook exception here kills the connection outright (mitmproxy
        # treats it as fatal), so any malformed/partial `data.context` must
        # be swallowed rather than raised.
        try:
            client = getattr(data.context, "client", None)
            sni = getattr(client, "sni", None) if client is not None else None
            peer = getattr(client, "peername", None) if client is not None else None
            client_ip = peer[0] if peer else None
            if self.passthrough.should_ignore(sni, client_ip=client_ip):
                data.ignore_connection = True
        except Exception:
            _log.exception("proxino passthrough hook failed")

    def tls_failed_client(self, data) -> None:
        try:
            client = getattr(data.context, "client", None)
            host = getattr(client, "sni", None) if client is not None else None
            if host is None:
                return
            peer = getattr(client, "peername", None) if client is not None else None
            client_ip = peer[0] if peer else "unknown"
            flipped = self.passthrough.record_failure(host, client_ip)
            hosts = self.passthrough.snapshot()
            if flipped:
                failures = next((h["failures"] for h in hosts if h["host"] == host), 0)
                _log.info(
                    "proxino: passing through %s (client %s refused the proxy certificate %d times)",
                    host, client_ip, failures,
                )
            self._publish({"type": "passthrough.update", "hosts": hosts})
        except Exception:
            _log.exception("proxino passthrough hook failed")

    def request(self, flow: HTTPFlow) -> None:
        # Stream a pending row the moment a request starts, so in-flight and
        # failed requests appear immediately (not only on response).
        self._emit("flow.new", flow)
        rule = self.breakpoints.should_pause(flow, "request", self.broadcaster.client_count() > 0)
        if rule is not None:
            self._pause(flow, "request", rule)

    def response(self, flow: HTTPFlow) -> None:
        rule = self.breakpoints.should_pause(flow, "response", self.broadcaster.client_count() > 0)
        if rule is not None:
            # flow.intercept() (inside _pause) holds the response back from the
            # client until resume_paused() runs. Do NOT emit flow.complete here
            # -- that would record the flow as done while it's still paused.
            # resume_paused() (or the timeout sweep) records the eventual
            # "complete" state once delivery actually proceeds.
            self._pause(flow, "response", rule)
            return
        self._emit("flow.complete", flow)

    def error(self, flow: HTTPFlow) -> None:
        self._emit("flow.error", flow)

    def _pause(self, flow: HTTPFlow, phase: str, rule) -> None:
        self._retain(flow)
        entry = self.breakpoints.pause(flow, phase, rule)
        rec = self._record(flow, state=f"paused_{phase}")
        self._publish({"type": "flow.update", "flow": rec.meta()})
        self._publish({"type": "breakpoint.paused", "entry": entry, "flow": rec.model_dump()})

    def resume_paused(self, flow_id: str, edits: dict | None) -> dict | None:
        flow = self.breakpoints.flow(flow_id)
        if flow is None:
            return None
        phase = self.breakpoints.get(flow_id)["phase"]
        modified = False
        if edits:
            modified = apply_request_edits(flow, edits) if phase == "request" else apply_response_edits(flow, edits)
        if modified:
            self._modified.add(flow_id)
        entry = self.breakpoints.resume(flow_id)
        rec = self._record(flow, state="pending" if phase == "request" else "complete")
        self._publish({"type": "flow.update", "flow": rec.meta()})
        self._publish({"type": "breakpoint.resumed", "flow_id": flow_id, "modified": modified})
        entry["modified"] = modified
        return entry

    def drop_paused(self, flow_id: str) -> dict | None:
        flow = self.breakpoints.flow(flow_id)
        if flow is None:
            return None
        entry = self.breakpoints.drop(flow_id)
        rec = self._record(flow, state="error")
        rec.error = "dropped at breakpoint"
        self.store.add(rec)
        self._publish({"type": "flow.update", "flow": rec.meta()})
        self._publish({"type": "breakpoint.dropped", "flow_id": flow_id})
        return entry

    def _sweep_once(self) -> None:
        for entry in self.breakpoints.sweep():
            flow = self._mflows.get(entry["flow_id"])
            if flow is not None:
                rec = self._record(flow, state="pending" if entry["phase"] == "request" else "complete")
                self._publish({"type": "flow.update", "flow": rec.meta()})
            self._publish({"type": "breakpoint.timeout", "flow_id": entry["flow_id"]})

    async def _sweep_loop(self) -> None:
        while True:
            await asyncio.sleep(1.0)
            try:
                self._sweep_once()
            except Exception:
                _log.exception("proxino breakpoint sweep failed")

    def _emit_ws_update(self, flow: HTTPFlow) -> None:
        rec = flow_to_record(flow, self.registry)
        if rec.ws is not None:
            rec.ws.messages = self.wsstore.count(flow.id)   # authoritative count survives the deque cap
        self.store.add(rec)
        self._publish({"type": "flow.update", "flow": rec.meta()})

    def websocket_start(self, flow: HTTPFlow) -> None:
        already_tracked = flow.id in self._mflows
        self._mflows[flow.id] = flow
        if already_tracked:
            self._mflows.move_to_end(flow.id)
        self._emit_ws_update(flow)

    def websocket_message(self, flow: HTTPFlow) -> None:
        if flow.id in self._mflows:
            self._mflows.move_to_end(flow.id)
        if not flow.websocket or not flow.websocket.messages:
            return
        m = flow.websocket.messages[-1]
        msg = self.wsstore.append(flow.id, m.from_client, m.is_text, m.content, m.timestamp)
        self._publish({"type": "ws.message", "flow_id": flow.id, "message": msg})
        now = self._ws_now()
        if now - self._ws_throttle.get(flow.id, -1.0) >= 0.25:
            self._ws_throttle[flow.id] = now
            self._emit_ws_update(flow)

    def websocket_end(self, flow: HTTPFlow) -> None:
        self._ws_throttle.pop(flow.id, None)
        self._emit_ws_update(flow)

    async def _flush_for_test(self) -> None:
        await asyncio.sleep(0)

    def replay(self, flow_id: str) -> bool:
        mflow = self._mflows.get(flow_id)
        if mflow is None:
            return False
        ctx.master.commands.call("replay.client", [mflow])
        return True

    def replay_edited(self, flow_id: str, edits: dict) -> bool:
        """Replay a retained flow with an edited request (edit & resend).

        `edits` may carry any of: method (str), url (str), headers
        (list of [name, value]), body (str). Missing keys leave the
        original request untouched. The clone gets a fresh id so it
        surfaces as a brand-new flow.
        """
        mflow = self._mflows.get(flow_id)
        if mflow is None:
            return False
        clone = mflow.copy()
        apply_request_edits(clone, edits)
        clone.response = None
        clone.error = None
        ctx.master.commands.call("replay.client", [clone])
        return True

addons = [Proxino()]
