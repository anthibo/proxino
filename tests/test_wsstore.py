import json
from proxino.wsstore import WsStore, MAX_TEXT

def test_append_text_and_binary_and_index():
    s = WsStore()
    m1 = s.append("f", True, True, b'{"a":1}', 10.0)
    m2 = s.append("f", False, False, b"\x81\xa1a\x01", 10.5)   # msgpack {"a":1}
    assert (m1["i"], m1["dir"], m1["type"], m1["size"]) == (0, "out", "text", 7)
    assert m1["view"] == "json" and json.loads(m1["pretty"]) == {"a": 1}
    assert (m2["i"], m2["dir"], m2["type"], m2["text"]) == (1, "in", "binary", None)
    assert m2["view"] == "msgpack" and "a" in m2["pretty"]

def test_get_after_and_total():
    s = WsStore()
    for k in range(5): s.append("f", True, True, str(k).encode(), float(k))
    msgs, total = s.get("f", after=2)
    assert [m["i"] for m in msgs] == [3, 4] and total == 5
    assert s.get("missing") == ([], 0)

def test_cap_evicts_oldest_but_keeps_index():
    s = WsStore(cap=3)
    for k in range(5): s.append("f", True, True, b"x", float(k))
    msgs, total = s.get("f")
    assert [m["i"] for m in msgs] == [2, 3, 4] and total == 5

def test_text_truncation_and_plain_text():
    s = WsStore()
    m = s.append("f", True, True, b"y" * (MAX_TEXT + 10), 1.0)
    assert len(m["text"]) == MAX_TEXT and m["view"] is None and m["pretty"] is None

def test_undecodable_binary_has_no_view():
    s = WsStore()
    m = s.append("f", False, False, b"\xff\xfe\x00garbage", 1.0)
    assert m["view"] is None and m["pretty"] is None and m["size"] == 10

def test_evict_and_clear():
    s = WsStore(); s.append("f", True, True, b"x", 1.0); s.append("g", True, True, b"x", 1.0)
    s.evict("f"); assert s.get("f") == ([], 0) and s.get("g")[1] == 1
    s.clear(); assert s.get("g") == ([], 0)
