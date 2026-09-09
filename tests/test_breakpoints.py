import pytest
from proxino.breakpoints import BreakpointRule, match_rule

R = lambda **kw: BreakpointRule(id=kw.pop("id", "r1"), **kw)

def test_empty_fields_match_anything():
    assert match_rule([R()], host="a.com", path="/x", method="GET", phase="request") is not None

def test_glob_host_and_path_case_insensitive():
    r = R(host="*.SOUM.sa", path="/v2/*")
    assert match_rule([r], host="endpoint.soum.sa", path="/V2/listings", method="GET", phase="request") is r
    assert match_rule([r], host="soum.sa", path="/v2/x", method="GET", phase="request") is None

def test_method_and_phase():
    r = R(method="POST", phase="response")
    assert match_rule([r], host="a", path="/", method="POST", phase="response") is r
    assert match_rule([r], host="a", path="/", method="GET", phase="response") is None
    assert match_rule([r], host="a", path="/", method="POST", phase="request") is None
    assert match_rule([R(phase="both")], host="a", path="/", method="GET", phase="response") is not None

def test_disabled_rule_skipped_and_first_match_wins():
    off = R(id="off", enabled=False); a = R(id="a", host="a*"); b = R(id="b")
    assert match_rule([off, a, b], host="abc", path="/", method="GET", phase="request") is a

def test_from_dict_validates():
    assert BreakpointRule.from_dict({"id": "x", "host": "h"}).phase == "both"
    with pytest.raises(ValueError): BreakpointRule.from_dict({"id": "x", "phase": "nope"})
    with pytest.raises(ValueError): BreakpointRule.from_dict({"host": "h"})   # id required
    assert BreakpointRule.from_dict({"id": "x", "method": "post"}).method == "POST"

from types import SimpleNamespace
from proxino.breakpoints import BreakpointEngine

class FakeFlow:
    def __init__(self, fid="f1", killable=True, is_replay=False):
        self.id = fid; self.killable = killable; self.is_replay = is_replay
        self.intercepted = False; self.killed = False
        self.request = SimpleNamespace(host="api.soum.sa", path="/v2/x?q=1", method="GET")
    def intercept(self): self.intercepted = True
    def resume(self): self.intercepted = False
    def kill(self): self.killed = True

def _engine(rules, enabled=True, timeout=60.0):
    t = {"now": 1000.0, "wall": 5000.0}
    eng = BreakpointEngine(lambda: {"enabled": enabled, "rules": rules}, timeout_s=timeout,
                           now=lambda: t["now"], wall=lambda: t["wall"])
    return eng, t

def test_should_pause_respects_enabled_clients_and_replay():
    rules = [{"id": "r", "host": "*.soum.sa", "phase": "request"}]
    eng, _ = _engine(rules)
    assert eng.should_pause(FakeFlow(), "request", has_clients=True) is not None
    assert eng.should_pause(FakeFlow(), "request", has_clients=False) is None
    assert eng.should_pause(FakeFlow(is_replay=True), "request", has_clients=True) is None
    assert eng.should_pause(FakeFlow(), "response", has_clients=True) is None
    eng2, _ = _engine(rules, enabled=False)
    assert eng2.should_pause(FakeFlow(), "request", has_clients=True) is None

def test_path_matching_ignores_query():
    eng, _ = _engine([{"id": "r", "path": "/v2/x"}])
    assert eng.should_pause(FakeFlow(), "request", has_clients=True) is not None

def test_pause_resume_drop_lifecycle():
    eng, t = _engine([{"id": "r"}])
    f = FakeFlow()
    entry = eng.pause(f, "request", eng.should_pause(f, "request", True))
    assert f.intercepted and entry["deadline"] == 5060.0 and eng.get("f1")["phase"] == "request"
    assert [e["flow_id"] for e in eng.paused()] == ["f1"] and "_flow" not in eng.paused()[0]
    assert eng.resume("f1")["flow_id"] == "f1" and not f.intercepted and eng.get("f1") is None
    assert eng.resume("f1") is None
    g = FakeFlow("g", killable=False); eng.pause(g, "response", None)
    assert eng.drop("g")["killed"] is False and not g.intercepted
    h = FakeFlow("h"); eng.pause(h, "request", None)
    assert eng.drop("h")["killed"] is True and h.killed

def test_sweep_auto_resumes_after_timeout():
    eng, t = _engine([{"id": "r"}], timeout=60.0)
    a, b = FakeFlow("a"), FakeFlow("b")
    eng.pause(a, "request", None); t["wall"] += 30; eng.pause(b, "request", None)
    assert eng.sweep() == []
    t["wall"] += 31
    swept = eng.sweep()
    assert [e["flow_id"] for e in swept] == ["a"] and not a.intercepted and b.intercepted

def test_sweep_uses_live_timeout_after_change():
    # timeout_s lowered after pause() must take effect immediately -- sweep()
    # must not freeze staleness at the timeout that was in force at pause time.
    eng, t = _engine([{"id": "r"}], timeout=60.0)
    f = FakeFlow("f")
    eng.pause(f, "request", None)
    t["wall"] += 10
    assert eng.sweep() == []          # not stale under the original 60s timeout
    eng.timeout_s = 5.0
    swept = eng.sweep()
    assert [e["flow_id"] for e in swept] == ["f"] and not f.intercepted

def test_public_deadline_reflects_current_timeout_s():
    eng, t = _engine([{"id": "r"}], timeout=60.0)
    f = FakeFlow("f")
    eng.pause(f, "request", None)
    eng.timeout_s = 10.0
    assert eng.get("f")["deadline"] == 5010.0
