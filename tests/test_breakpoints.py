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
