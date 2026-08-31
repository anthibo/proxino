from proxino.store import FlowStore
from tests.test_models import make_flow

def test_add_get_and_meta_list():
    s = FlowStore()
    s.add(make_flow(id="a"))
    s.add(make_flow(id="b"))
    assert s.get("a").id == "a"
    ids = [m["id"] for m in s.list_meta()]
    assert ids == ["b", "a"]  # newest first
    assert "body" not in s.list_meta()[0]["request"]

def test_ring_buffer_drops_oldest():
    s = FlowStore(capacity=2)
    for i in "abc":
        s.add(make_flow(id=i))
    assert s.get("a") is None
    assert len(s) == 2

def test_client_counts_and_clear():
    s = FlowStore()
    s.add(make_flow(id="a", client={"ip": "1.1.1.1", "label": "x"}))
    s.add(make_flow(id="b", client={"ip": "1.1.1.1", "label": "x"}))
    s.add(make_flow(id="c", client={"ip": "2.2.2.2", "label": "y"}))
    assert s.client_counts() == {"1.1.1.1": 2, "2.2.2.2": 1}
    s.clear()
    assert len(s) == 0 and s.client_counts() == {}
