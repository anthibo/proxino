import asyncio
import pytest
from fastapi.testclient import TestClient
from proxino.server import make_app
from proxino.store import FlowStore
from proxino.clients import ClientRegistry
from proxino.broadcaster import Broadcaster
from proxino.wsstore import WsStore
from tests.test_models import make_flow

def client(tmp_path):
    store = FlowStore()
    store.add(make_flow(id="a"))
    reg = ClientRegistry(tmp_path / "c.json")
    return TestClient(make_app(store, reg, Broadcaster())), store, reg

def test_list_and_detail(tmp_path):
    c, _, _ = client(tmp_path)
    lst = c.get("/api/flows").json()
    assert lst[0]["id"] == "a" and "body" not in lst[0]["request"]
    detail = c.get("/api/flows/a").json()
    assert detail["response"]["body"] == '{"ok":true}'
    assert c.get("/api/flows/missing").status_code == 404

def test_clear_and_clients_and_labels(tmp_path):
    c, store, reg = client(tmp_path)
    assert c.get("/api/clients").json()[0]["count"] == 1
    c.put("/api/clients/192.168.1.23", json={"label": "My iPhone"})
    assert reg.all_labels()["192.168.1.23"] == "My iPhone"
    c.delete("/api/flows")
    assert c.get("/api/flows").json() == []


def test_clear_uses_provided_hook_instead_of_bare_store_clear(tmp_path):
    # DELETE /api/flows must go through the addon's own clear hook (which also
    # drops breakpoint bookkeeping like `_modified`), not call store.clear()
    # directly -- otherwise addon-side state tied to cleared flows leaks.
    store = FlowStore(); store.add(make_flow(id="a"))
    reg = ClientRegistry(tmp_path / "c.json")
    calls = []
    def on_clear():
        calls.append(1)
        store.clear()
    c = TestClient(make_app(store, reg, Broadcaster(), on_clear=on_clear))
    c.delete("/api/flows")
    assert calls == [1]
    assert c.get("/api/flows").json() == []

def test_clear_runs_on_the_event_loop(tmp_path):
    # DELETE /api/flows must run on the event loop: on_clear (Proxino.clear)
    # calls self._publish(...) -> asyncio.ensure_future(...) whenever a flow
    # is paused at clear time, which raises RuntimeError with no running
    # loop (i.e. in a threadpool-worker sync handler).
    store = FlowStore(); store.add(make_flow(id="a"))
    reg = ClientRegistry(tmp_path / "c.json")
    calls = []
    def on_clear():
        asyncio.get_running_loop()
        calls.append(1)
        store.clear()
    c = TestClient(make_app(store, reg, Broadcaster(), on_clear=on_clear),
                   raise_server_exceptions=False)
    resp = c.delete("/api/flows")
    assert resp.status_code == 200
    assert calls == [1]
    assert c.get("/api/flows").json() == []

def test_connect_info(tmp_path):
    c, _, _ = client(tmp_path)
    info = c.get("/api/connect-info").json()
    assert info["proxy_port"] == 8080
    assert "lan_ips" in info and "cert_url" in info

def test_detail_includes_top_level_duration(tmp_path):
    c, _, _ = client(tmp_path)  # existing helper; make_flow has timing.duration_ms=142
    detail = c.get("/api/flows/a").json()
    assert detail["duration_ms"] == 142

def test_session_download_and_load(tmp_path):
    c, store, _ = client(tmp_path)          # store seeded with flow "a"
    dl = c.get("/api/session")
    assert dl.headers["content-disposition"].startswith("attachment")
    body = dl.json()
    assert body[0]["response"]["body"] == '{"ok":true}'
    c.delete("/api/flows")                    # empty it
    assert c.get("/api/flows").json() == []
    r = c.post("/api/session", json=body)
    assert r.json() == {"loaded": 1}
    assert c.get("/api/flows").json()[0]["id"] == "a"

def test_har_export_endpoint(tmp_path):
    c, _, _ = client(tmp_path)
    r = c.get("/api/export/har")
    assert r.headers["content-disposition"].startswith("attachment")
    assert r.json()["log"]["entries"][0]["request"]["method"] == "GET"

def test_ca_info_endpoint(tmp_path):
    c, _, _ = client(tmp_path)
    info = c.get("/api/ca-info").json()
    assert "present" in info and info["cert_url"] == "http://mitm.it"

def test_replay_endpoint(tmp_path):
    from proxino.server import make_app
    from proxino.store import FlowStore
    from proxino.clients import ClientRegistry
    from proxino.broadcaster import Broadcaster
    store = FlowStore(); store.add(make_flow(id="a"))
    seen = []
    def replayer(fid): seen.append(fid); return fid == "a"
    c = TestClient(make_app(store, ClientRegistry(tmp_path/"c.json"), Broadcaster(), replayer=replayer))
    assert c.post("/api/flows/a/replay").json() == {"ok": True}
    assert seen == ["a"]
    assert c.post("/api/flows/missing/replay").status_code == 404

def test_replay_503_without_replayer(tmp_path):
    c, _, _ = client(tmp_path)   # make_app built without replayer
    assert c.post("/api/flows/a/replay").status_code == 503

def test_replay_edited_endpoint(tmp_path):
    store = FlowStore(); store.add(make_flow(id="a"))
    seen = []
    def edited(fid, edits): seen.append((fid, edits)); return fid == "a"
    c = TestClient(make_app(store, ClientRegistry(tmp_path/"c.json"), Broadcaster(),
                            edited_replayer=edited))
    body = {"method": "POST", "url": "http://x/y", "headers": [["h", "v"]], "body": "{}"}
    assert c.post("/api/flows/a/replay-edited", json=body).json() == {"ok": True}
    assert seen[0][0] == "a"
    assert seen[0][1] == {"method": "POST", "url": "http://x/y",
                          "headers": [("h", "v")], "body": "{}"}
    assert c.post("/api/flows/missing/replay-edited", json={}).status_code == 404

def test_replay_edited_drops_none_fields(tmp_path):
    store = FlowStore(); store.add(make_flow(id="a"))
    captured = {}
    def edited(fid, edits): captured.update(edits); return True
    c = TestClient(make_app(store, ClientRegistry(tmp_path/"c.json"), Broadcaster(),
                            edited_replayer=edited))
    c.post("/api/flows/a/replay-edited", json={"method": "PUT"})
    assert captured == {"method": "PUT"}   # url/headers/body omitted, not sent as None

def test_replay_edited_503_without_replayer(tmp_path):
    c, _, _ = client(tmp_path)
    assert c.post("/api/flows/a/replay-edited", json={}).status_code == 503

def test_passthrough_empty_list_without_registry(tmp_path):
    c, _, _ = client(tmp_path)   # make_app built without a passthrough registry
    assert c.get("/api/passthrough").json() == []

def test_passthrough_snapshot_endpoint(tmp_path):
    from proxino.passthrough import PassthroughRegistry
    pth = PassthroughRegistry(threshold=1)
    pth.record_failure("pinned.example.com", "1.2.3.4")
    c = TestClient(make_app(FlowStore(), ClientRegistry(tmp_path / "c.json"), Broadcaster(),
                            passthrough=pth))
    hosts = c.get("/api/passthrough").json()
    assert hosts[0]["host"] == "pinned.example.com"

def test_passthrough_delete_removes_and_publishes(tmp_path):
    from proxino.passthrough import PassthroughRegistry
    pth = PassthroughRegistry(threshold=1)
    pth.record_failure("pinned.example.com", "1.2.3.4")
    published = []
    bc = Broadcaster()
    async def fake_publish(evt): published.append(evt)
    bc.publish = fake_publish
    c = TestClient(make_app(FlowStore(), ClientRegistry(tmp_path / "c.json"), bc, passthrough=pth))
    r = c.delete("/api/passthrough/pinned.example.com")
    assert r.json() == {"removed": True}
    assert c.get("/api/passthrough").json() == []
    assert published[-1]["type"] == "passthrough.update"

def test_passthrough_delete_unknown_host_404(tmp_path):
    from proxino.passthrough import PassthroughRegistry
    pth = PassthroughRegistry()
    c = TestClient(make_app(FlowStore(), ClientRegistry(tmp_path / "c.json"), Broadcaster(),
                            passthrough=pth))
    assert c.delete("/api/passthrough/nope.example.com").status_code == 404

def test_passthrough_delete_config_host_409(tmp_path):
    # Config-sourced hosts re-match their pattern on the very next hello, so
    # "retry decrypt" can't apply to them — the API must say so explicitly
    # instead of pretending the removal worked (or 404-ing as if unknown).
    from proxino.passthrough import PassthroughRegistry
    pth = PassthroughRegistry(patterns=["*.pinned.com"])
    pth.should_ignore("host.pinned.com")
    c = TestClient(make_app(FlowStore(), ClientRegistry(tmp_path / "c.json"), Broadcaster(),
                            passthrough=pth))
    r = c.delete("/api/passthrough/host.pinned.com")
    assert r.status_code == 409
    assert "config.json" in r.json()["detail"]
    # untouched — still listed as a config passthrough host
    assert c.get("/api/passthrough").json()[0]["host"] == "host.pinned.com"

def test_breakpoints_crud_and_validation(tmp_path):
    c, _, reg = client(tmp_path)
    assert c.get("/api/breakpoints").json() == {"enabled": True, "rules": []}
    body = {"enabled": True, "rules": [{"id": "r1", "host": "*.soum.sa", "phase": "request"}]}
    assert c.put("/api/breakpoints", json=body).json()["rules"][0]["method"] == ""
    assert reg.breakpoints()["rules"][0]["id"] == "r1"
    assert c.put("/api/breakpoints", json={"enabled": True, "rules": [{"id": "x", "phase": "bad"}]}).status_code == 422

def test_paused_endpoints(tmp_path):
    from proxino.breakpoints import BreakpointEngine
    calls = {}
    eng = BreakpointEngine(lambda: {"enabled": True, "rules": []})
    store = FlowStore(); store.add(make_flow(id="p", state="paused_request"))
    class F:  # minimal flow stand-in for the engine
        id = "p"; killable = True; is_replay = False
        def intercept(self): pass
        def resume(self): pass
        def kill(self): pass
    eng.pause(F(), "request", None)
    def resume(fid, edits):
        if eng.get(fid) is None:
            return None
        calls["resume"] = (fid, edits); return {"flow_id": fid, "modified": bool(edits)}
    def drop(fid):
        if eng.get(fid) is None:
            return None
        calls["drop"] = fid; return {"flow_id": fid}
    reg = ClientRegistry(tmp_path / "c.json")
    c = TestClient(make_app(store, reg, Broadcaster(), breakpoints=eng, resume_paused=resume, drop_paused=drop))
    lst = c.get("/api/paused").json()
    assert lst[0]["flow_id"] == "p" and lst[0]["flow"]["id"] == "p" and lst[0]["phase"] == "request"
    assert c.post("/api/paused/p/resume", json={"headers": [["a", "b"]]}).json() == {"ok": True, "modified": True}
    assert calls["resume"] == ("p", {"headers": [["a", "b"]]})
    assert c.post("/api/paused/nope/resume").status_code == 404
    assert c.post("/api/paused/p/drop").json() == {"ok": True} and calls["drop"] == "p"

def _paused_client(tmp_path, **kwargs):
    from proxino.breakpoints import BreakpointEngine
    eng = BreakpointEngine(lambda: {"enabled": True, "rules": []})
    store = FlowStore(); store.add(make_flow(id="p", state="paused_request"))
    class F:  # minimal flow stand-in for the engine
        id = "p"; killable = True; is_replay = False
        def intercept(self): pass
        def resume(self): pass
        def kill(self): pass
    eng.pause(F(), "request", None)
    reg = ClientRegistry(tmp_path / "c.json")
    app = make_app(store, reg, Broadcaster(), breakpoints=eng, **kwargs)
    return TestClient(app, raise_server_exceptions=False)

def test_resume_runs_on_the_event_loop(tmp_path):
    # resume_paused is invoked from the endpoint handler; it must see a running
    # event loop (mitmproxy's flow.resume()/publish() are not thread-safe and
    # asyncio.ensure_future requires one) rather than a threadpool worker thread.
    def resume_paused(fid, edits):
        asyncio.get_running_loop()
        return {"flow_id": "p", "modified": False}

    c = _paused_client(tmp_path, resume_paused=resume_paused)
    resp = c.post("/api/paused/p/resume")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "modified": False}

def test_drop_runs_on_the_event_loop(tmp_path):
    def drop_paused(fid):
        asyncio.get_running_loop()
        return {"flow_id": "p"}

    c = _paused_client(tmp_path, drop_paused=drop_paused)
    resp = c.post("/api/paused/p/drop")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

def test_ws_messages_endpoint(tmp_path):
    store = FlowStore(); store.add(make_flow(id="w", kind="ws", ws={"messages": 0, "open": True}))
    ws = WsStore(); ws.append("w", True, True, b"hello", 1.0); ws.append("w", False, True, b"world", 2.0)
    c = TestClient(make_app(store, ClientRegistry(tmp_path / "c.json"), Broadcaster(), wsstore=ws))
    body = c.get("/api/flows/w/ws").json()
    assert body["total"] == 2 and [m["text"] for m in body["messages"]] == ["hello", "world"]
    assert c.get("/api/flows/w/ws?after=0").json()["messages"][0]["i"] == 1
    assert c.get("/api/flows/nope/ws").status_code == 404
    store.add(make_flow(id="h")); assert c.get("/api/flows/h/ws").json() == {"messages": [], "total": 0}

async def test_ws_loop_unregisters_on_non_disconnect_error():
    # The /ws route must drop a socket from the broadcaster even when it
    # dies some way other than WebSocketDisconnect -- otherwise it lingers
    # in the broadcaster set and client_count() stays > 0 with no live UI,
    # which can make a breakpoint rule pause a request nobody will ever see.
    from proxino.server import _run_ws_loop

    class FakeSock:
        async def receive_text(self):
            raise RuntimeError("socket died some other way")

    bc = Broadcaster()
    sock = FakeSock()
    await bc.register(sock)
    assert bc.client_count() == 1
    with pytest.raises(RuntimeError):
        await _run_ws_loop(sock, bc)
    assert bc.client_count() == 0
