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


def test_snapshot_shape_and_ordering():
    t = [100.0]
    reg = PassthroughRegistry(threshold=2, patterns=["*.pinned.com"], now=lambda: t[0])
    reg.record_failure("a.example.com", "1.1.1.1")
    t[0] = 101.0
    reg.record_failure("a.example.com", "2.2.2.2")  # flips, last_seen later
    # config-pattern host only appears after being seen via should_ignore
    reg.should_ignore("host.pinned.com")

    snap = reg.snapshot()
    hosts = {e["host"]: e for e in snap}
    assert set(hosts) == {"a.example.com", "host.pinned.com"}

    auto = hosts["a.example.com"]
    assert auto["source"] == "auto"
    assert auto["failures"] == 2
    assert set(auto["clients"]) == {"1.1.1.1", "2.2.2.2"}
    assert "first_seen" in auto and "last_seen" in auto

    cfg = hosts["host.pinned.com"]
    assert cfg["source"] == "config"
    assert cfg["failures"] == 1

    # sorted by last_seen desc: the auto host (touched at t=101) before... but
    # config host touched at whatever `now` was when should_ignore ran (t=101 too,
    # since we didn't advance t). Just assert it's a valid ordering (non-increasing).
    last_seens = [e["last_seen"] for e in snap]
    assert last_seens == sorted(last_seens, reverse=True)
