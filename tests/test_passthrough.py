from proxino.passthrough import PassthroughRegistry


def test_below_threshold_does_not_flip():
    reg = PassthroughRegistry(threshold=2)
    assert reg.record_failure("a.example.com", "1.1.1.1") is False
    assert reg.should_ignore("a.example.com") is False


def test_second_failure_within_window_flips_exactly_once():
    reg = PassthroughRegistry(threshold=2)
    assert reg.record_failure("a.example.com", "1.1.1.1") is False
    assert reg.record_failure("a.example.com", "1.1.1.1") is True
    assert reg.should_ignore("a.example.com") is True
    # a third failure records but does not "flip" again
    assert reg.record_failure("a.example.com", "1.1.1.1") is False
    assert reg.should_ignore("a.example.com") is True


def test_failures_outside_window_are_pruned_and_ignored():
    t = [0.0]
    reg = PassthroughRegistry(threshold=2, window_s=60.0, now=lambda: t[0])
    assert reg.record_failure("a.example.com", "1.1.1.1") is False
    t[0] = 61.0  # first failure now outside the 60s window
    assert reg.record_failure("a.example.com", "1.1.1.1") is False
    assert reg.should_ignore("a.example.com") is False


def test_patterns_match_case_insensitively_with_wildcards():
    reg = PassthroughRegistry(patterns=["*.itunes.apple.com"])
    assert reg.should_ignore("gs.ITUNES.apple.com") is True
    assert reg.should_ignore("other.example.com") is False


def test_should_ignore_none_is_false():
    reg = PassthroughRegistry(patterns=["*"])
    assert reg.should_ignore(None) is False


def test_remove_resets_auto_host():
    reg = PassthroughRegistry(threshold=2)
    reg.record_failure("a.example.com", "1.1.1.1")
    reg.record_failure("a.example.com", "1.1.1.1")
    assert reg.should_ignore("a.example.com") is True
    assert reg.remove("a.example.com") is True
    assert reg.should_ignore("a.example.com") is False
    # counters reset: one more failure should not immediately re-flip
    assert reg.record_failure("a.example.com", "1.1.1.1") is False
    assert reg.should_ignore("a.example.com") is False


def test_remove_unknown_host_returns_false():
    reg = PassthroughRegistry()
    assert reg.remove("nope.example.com") is False


def test_remove_config_host_returns_false_and_keeps_entry():
    # Config-sourced hosts re-match on the next hello, so "retry decrypt"
    # cannot meaningfully apply to them — remove() must refuse and must be
    # a true no-op (not silently reset the entry's counters).
    reg = PassthroughRegistry(patterns=["*.pinned.com"])
    reg.should_ignore("host.pinned.com")
    reg.should_ignore("host.pinned.com")
    before = {e["host"]: e for e in reg.snapshot()}["host.pinned.com"]
    assert reg.remove("host.pinned.com") is False
    after = {e["host"]: e for e in reg.snapshot()}["host.pinned.com"]
    assert after["source"] == "config"
    # a real no-op: counters weren't reset by the failed remove
    assert after["failures"] == before["failures"] == 2
    assert after["first_seen"] == before["first_seen"]


def test_snapshot_shape_and_ordering():
    # Two independently-injectable clocks: `now` (monotonic) drives the
    # sliding-failure-window math, `wall` drives first_seen/last_seen.
    t = [100.0]
    w = [1000.0]
    reg = PassthroughRegistry(threshold=2, patterns=["*.pinned.com"],
                               now=lambda: t[0], wall=lambda: w[0])
    reg.record_failure("a.example.com", "1.1.1.1")
    t[0] = 101.0
    w[0] = 1001.0
    reg.record_failure("a.example.com", "2.2.2.2")  # flips, last_seen later
    w[0] = 1002.0
    # config-pattern host only appears after being seen via should_ignore
    reg.should_ignore("host.pinned.com")

    snap = reg.snapshot()
    hosts = {e["host"]: e for e in snap}
    assert set(hosts) == {"a.example.com", "host.pinned.com"}

    auto = hosts["a.example.com"]
    assert auto["source"] == "auto"
    assert auto["failures"] == 2
    assert set(auto["clients"]) == {"1.1.1.1", "2.2.2.2"}
    assert auto["first_seen"] == 1000.0
    assert auto["last_seen"] == 1001.0

    cfg = hosts["host.pinned.com"]
    assert cfg["source"] == "config"
    assert cfg["failures"] == 1
    assert cfg["first_seen"] == 1002.0
    assert cfg["last_seen"] == 1002.0

    # deterministic ordering under the fake wall clock: host.pinned.com was
    # touched last (w=1002), a.example.com before it (w=1001).
    assert [e["host"] for e in snap] == ["host.pinned.com", "a.example.com"]


def test_should_ignore_records_client_ip_for_config_hosts():
    reg = PassthroughRegistry(patterns=["*.pinned.com"])
    reg.should_ignore("host.pinned.com", client_ip="5.5.5.5")
    snap = {e["host"]: e for e in reg.snapshot()}
    assert snap["host.pinned.com"]["clients"] == ["5.5.5.5"]


def test_snapshot_active_flag_watching_vs_flipped():
    reg = PassthroughRegistry(threshold=2)
    reg.record_failure("watching.example.com", "1.1.1.1")  # below threshold
    reg.record_failure("flipped.example.com", "1.1.1.1")
    reg.record_failure("flipped.example.com", "1.1.1.1")   # flips
    snap = {e["host"]: e for e in reg.snapshot()}
    assert snap["watching.example.com"]["active"] is False
    assert snap["flipped.example.com"]["active"] is True


def test_snapshot_config_host_always_active():
    reg = PassthroughRegistry(patterns=["*.pinned.com"])
    reg.should_ignore("host.pinned.com")
    snap = {e["host"]: e for e in reg.snapshot()}
    assert snap["host.pinned.com"]["active"] is True
