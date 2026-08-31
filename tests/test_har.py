from proxino.har import flows_to_har
from tests.test_models import make_flow

def test_har_shape():
    har = flows_to_har([make_flow(id="a")])
    log = har["log"]
    assert log["version"] == "1.2"
    assert log["creator"]["name"] == "Proxino"
    e = log["entries"][0]
    assert e["request"]["method"] == "GET"
    assert e["request"]["url"] == "https://api.soum.sa/v2/x"
    assert e["response"]["status"] == 200
    assert e["response"]["content"]["text"] == '{"ok":true}'
    assert e["time"] == 142
    assert e["timings"]["wait"] >= -1

def test_har_missing_response_uses_minus_one():
    f = make_flow(id="b", response=None, timing={"start":1000,"duration_ms":None})
    e = flows_to_har([f])["log"]["entries"][0]
    assert e["response"]["status"] == 0
    assert e["time"] == -1
