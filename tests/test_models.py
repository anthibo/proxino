from proxino.models import Flow

def make_flow(**over):
    base = dict(
        id="f1", timestamp=1000,
        client={"ip": "192.168.1.23", "label": "iPhone"},
        method="GET", scheme="https", host="api.soum.sa", port=443,
        path="/v2/x", query="", http_version="HTTP/2",
        request={"headers": [["accept", "*/*"]], "size": 0, "body": None},
        response={"status": 200, "reason": "OK", "headers": [], "size": 12,
                  "content_type": "application/json", "body": '{"ok":true}'},
        timing={"start": 1000, "req_done": 1001, "resp_start": 1100,
                "resp_done": 1142, "duration_ms": 142},
        state="complete", error=None,
    )
    base.update(over)
    return Flow(**base)

def test_meta_excludes_bodies():
    meta = make_flow().meta()
    assert meta["response"]["status"] == 200
    assert "body" not in meta["request"]
    assert "body" not in meta["response"]
    assert meta["duration_ms"] == 142
    assert meta["client"]["label"] == "iPhone"

def test_full_serialization_includes_bodies():
    d = make_flow().model_dump()
    assert d["response"]["body"] == '{"ok":true}'
