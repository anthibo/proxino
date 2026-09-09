import json
import time
from proxino.wsstore import WsStore, MAX_TEXT
from proxino.decode import MAX_DECODE, MAX_PRETTY

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

def test_large_json_text_frame_skips_parse_and_stays_fast():
    s = WsStore()
    content = json.dumps({"a": "x" * (MAX_DECODE + 10000)}).encode()
    assert len(content) > MAX_DECODE
    t0 = time.perf_counter()
    m = s.append("f", True, True, content, 1.0)
    elapsed = time.perf_counter() - t0
    assert m["view"] is None and m["pretty"] is None
    assert elapsed < 0.05

def test_large_binary_frame_skips_decode_and_stays_fast():
    s = WsStore()
    content = b"\xff" * (MAX_DECODE + 10000)
    t0 = time.perf_counter()
    m = s.append("f", False, False, content, 1.0)
    elapsed = time.perf_counter() - t0
    assert m["view"] is None and m["pretty"] is None
    assert elapsed < 0.05

def test_pretty_output_is_capped_at_max_pretty():
    s = WsStore()
    # Nested arrays keep the compact form (what gets parsed, bounded by
    # MAX_TEXT) small while indent=2 blows the prettified form well past
    # MAX_PRETTY -- exercises the cap independently of the MAX_DECODE bypass.
    data = [[[i % 10]] for i in range(9200)]
    content = json.dumps(data).encode()
    assert len(content) < MAX_TEXT
    uncapped_pretty_len = len(json.dumps(data, indent=2, ensure_ascii=False))
    assert uncapped_pretty_len > MAX_PRETTY
    m = s.append("f", True, True, content, 1.0)
    assert m["view"] == "json"
    assert len(m["pretty"]) <= MAX_PRETTY + len("\n… truncated")
    assert m["pretty"].endswith("\n… truncated")

def test_evict_and_clear():
    s = WsStore(); s.append("f", True, True, b"x", 1.0); s.append("g", True, True, b"x", 1.0)
    s.evict("f"); assert s.get("f") == ([], 0) and s.get("g")[1] == 1
    s.clear(); assert s.get("g") == ([], 0)
