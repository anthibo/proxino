from proxino.sessions import dump_session, load_session
from proxino.store import FlowStore
from tests.test_models import make_flow

def test_dump_then_load_roundtrips_with_bodies():
    s = FlowStore()
    s.add(make_flow(id="a"))
    s.add(make_flow(id="b"))
    data = dump_session(s)
    assert [f["id"] for f in data] == ["b", "a"]            # newest-first
    assert data[0]["response"]["body"] == '{"ok":true}'      # bodies included

    s2 = FlowStore()
    n = load_session(s2, data)
    assert n == 2
    assert s2.get("a").response.body == '{"ok":true}'
    assert [m["id"] for m in s2.list_meta()] == ["b", "a"]

def test_load_replaces_existing():
    s = FlowStore(); s.add(make_flow(id="old"))
    load_session(s, [make_flow(id="new").model_dump()])
    assert s.get("old") is None and s.get("new") is not None
