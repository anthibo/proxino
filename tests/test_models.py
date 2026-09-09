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

def test_meta_strips_body_pretty_but_keeps_body_view():
    flow = make_flow(response={
        "status": 200, "reason": "OK", "headers": [], "size": 12,
        "content_type": "application/x-protobuf", "body": None,
        "body_view": "protobuf", "body_pretty": "1: 150\n",
    })
    meta = flow.meta()
    assert "body_pretty" not in meta["response"]
    assert meta["response"]["body_view"] == "protobuf"
    d = flow.model_dump()
    assert d["response"]["body_pretty"] == "1: 150\n"

def test_flow_kind_defaults_and_ws_summary_in_meta():
    f = make_flow()
    assert f.kind == "http" and f.ws is None and f.meta()["kind"] == "http"
    g = make_flow(kind="ws", ws={"messages": 3, "open": True, "closed_by": None, "close_code": None, "close_reason": None})
    assert g.meta()["ws"]["messages"] == 3 and g.meta()["ws"]["open"] is True
