from __future__ import annotations
import asyncio
import logging
from collections import OrderedDict
from pathlib import Path
from mitmproxy import ctx
from mitmproxy.addonmanager import Loader
from mitmproxy.http import HTTPFlow
from proxino.store import FlowStore
from proxino.clients import ClientRegistry
from proxino.broadcaster import Broadcaster
from proxino.transform import flow_to_record

_log = logging.getLogger("proxino")

class Proxino:
    def __init__(self) -> None:
        self.store = FlowStore()
        self.registry = ClientRegistry(Path.home() / ".proxino" / "config.json")
        self.broadcaster = Broadcaster()
        self._mflows: OrderedDict[str, HTTPFlow] = OrderedDict()
        self._mflow_cap = 5000

    def load(self, loader: Loader) -> None:
        loader.add_option("proxino_web_port", int, 8081, "Proxino web UI port")

    async def running(self) -> None:
        import uvicorn, webbrowser
        from proxino.server import make_app
        port = ctx.options.proxino_web_port
        app = make_app(self.store, self.registry, self.broadcaster,
                       replayer=self.replay, edited_replayer=self.replay_edited,
                       web_port=port)
        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
        asyncio.ensure_future(uvicorn.Server(config).serve())
        webbrowser.open(f"http://127.0.0.1:{port}")

    def _emit(self, evt_type: str, flow: HTTPFlow) -> None:
        rec = flow_to_record(flow, self.registry)
        self.store.add(rec)
        self._mflows[flow.id] = flow
        self._mflows.move_to_end(flow.id)
        while len(self._mflows) > self._mflow_cap:
            self._mflows.popitem(last=False)
        evt = {"type": evt_type, "flow": rec.meta()}
        fut = asyncio.ensure_future(self.broadcaster.publish(evt))
        fut.add_done_callback(
            lambda f: f.exception() and _log.error("proxino publish failed: %r", f.exception())
        )

    def request(self, flow: HTTPFlow) -> None:
        # Stream a pending row the moment a request starts, so in-flight and
        # failed requests appear immediately (not only on response).
        self._emit("flow.new", flow)

    def response(self, flow: HTTPFlow) -> None:
        self._emit("flow.complete", flow)

    def error(self, flow: HTTPFlow) -> None:
        self._emit("flow.error", flow)

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
        from mitmproxy.http import Headers
        mflow = self._mflows.get(flow_id)
        if mflow is None:
            return False
        clone = mflow.copy()
        req = clone.request
        method = edits.get("method")
        if method:
            req.method = method
        url = edits.get("url")
        if url:
            req.url = url
        headers = edits.get("headers")
        if headers is not None:
            req.headers = Headers([(k.encode("utf-8"), v.encode("utf-8"))
                                   for k, v in headers])
        body = edits.get("body")
        if body is not None:
            req.text = body  # recomputes content-length
        clone.response = None
        clone.error = None
        ctx.master.commands.call("replay.client", [clone])
        return True

addons = [Proxino()]
