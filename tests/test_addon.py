from mitmproxy.test import taddons, tflow
from proxino.addon import Proxino

async def test_response_hook_records_and_publishes():
    addon = Proxino()
    published = []
    async def fake_publish(evt): published.append(evt)
    addon.broadcaster.publish = fake_publish
    with taddons.context(addon):
        f = tflow.tflow(resp=True)
        f.client_conn.peername = ("10.0.0.5", 5000)
        addon.response(f)
        # drain the scheduled publish
        await addon._flush_for_test()
    assert len(addon.store) == 1
    assert published[-1]["type"] == "flow.complete"
    assert published[-1]["flow"]["client"]["ip"] == "10.0.0.5"


async def test_error_hook_records_and_publishes():
    addon = Proxino()
    published = []
    async def fake_publish(evt): published.append(evt)
    addon.broadcaster.publish = fake_publish
    with taddons.context(addon):
        f = tflow.tflow(err=True)
        f.client_conn.peername = ("10.0.0.5", 5000)
        addon.error(f)
        # drain the scheduled publish
        await addon._flush_for_test()
    assert len(addon.store) == 1
    assert published[-1]["type"] == "flow.error"


async def test_retains_mflow_and_replays():
    addon = Proxino()
    async def noop(evt): pass
    addon.broadcaster.publish = noop
    with taddons.context(addon) as tctx:
        calls = []
        # stub the command dispatcher so no real proxy is needed
        tctx.master.commands.call = lambda name, args: calls.append((name, args))
        f = tflow.tflow(resp=True)
        f.client_conn.peername = ("10.0.0.5", 5000)
        addon.response(f)
        await addon._flush_for_test()
        fid = f.id
        assert addon.replay(fid) is True
        assert calls and calls[0][0] == "replay.client"
        assert addon.replay("nope") is False

async def test_request_hook_streams_pending_then_completes_in_place():
    addon = Proxino()
    published = []
    async def fake_publish(evt): published.append(evt)
    addon.broadcaster.publish = fake_publish
    from mitmproxy.test import tutils
    with taddons.context(addon):
        f = tflow.tflow()                    # request only, no response yet
        f.client_conn.peername = ("10.0.0.9", 5000)
        addon.request(f)                     # pending row streamed on request start
        await addon._flush_for_test()
        assert published[-1]["type"] == "flow.new"
        assert published[-1]["flow"]["state"] == "pending"
        assert len(addon.store) == 1
        f.response = tutils.tresp(status_code=200)
        addon.response(f)                    # same id completes
        await addon._flush_for_test()
        assert published[-1]["type"] == "flow.complete"
        assert len(addon.store) == 1          # updated in place, not duplicated

async def test_replay_edited_applies_edits_to_a_clone():
    addon = Proxino()
    async def noop(evt): pass
    addon.broadcaster.publish = noop
    with taddons.context(addon) as tctx:
        replayed = []
        tctx.master.commands.call = lambda name, args: replayed.append((name, args))
        f = tflow.tflow(resp=True)
        f.client_conn.peername = ("10.0.0.5", 5000)
        addon.response(f)
        await addon._flush_for_test()
        edits = {"method": "POST", "url": "http://edited.test/new",
                 "headers": [["X-Test", "1"]], "body": "hello"}
        assert addon.replay_edited(f.id, edits) is True
        assert addon.replay_edited("nope", edits) is False
        name, args = replayed[0]
        assert name == "replay.client"
        clone = args[0]
        assert clone.id != f.id                     # fresh flow, not the original
        assert clone.request.method == "POST"
        assert clone.request.url == "http://edited.test/new"
        assert clone.request.headers["X-Test"] == "1"
        assert clone.request.text == "hello"
        assert clone.response is None
        assert f.request.method == "GET"            # original untouched

async def test_mflow_map_evicts_with_capacity():
    addon = Proxino()
    addon.store.capacity = 2
    addon._mflow_cap = 2
    import asyncio
    async def noop(evt): pass
    addon.broadcaster.publish = noop
    from mitmproxy.test import tflow as _t
    with taddons.context(addon):
        ids = []
        for _ in range(3):
            f = _t.tflow(resp=True); f.client_conn.peername = ("1.1.1.1", 1)
            addon.response(f); ids.append(f.id)
        assert len(addon._mflows) == 2
        assert ids[0] not in addon._mflows
