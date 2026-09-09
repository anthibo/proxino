from pathlib import Path
from proxino.clients import ClientRegistry

def test_guess_from_user_agent(tmp_path):
    r = ClientRegistry(tmp_path / "config.json")
    assert "iPhone" in r.label_for("1.1.1.1", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")
    assert "Android" in r.label_for("2.2.2.2", "Dalvik/2.1 (Linux; Android 14)")
    assert r.label_for("3.3.3.3", None) == "3.3.3.3"

def test_device_for_returns_label_and_kind(tmp_path):
    r = ClientRegistry(tmp_path / "config.json")
    assert r.device_for("1.1.1.1", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)") == ("iPhone", "phone")
    assert r.device_for("2.2.2.2", "MyApp/3.4 CFNetwork/1490 Darwin/23.1.0") == ("iOS app", "phone")
    assert r.device_for("3.3.3.3", "okhttp/4.12.0") == ("Android app", "phone")
    assert r.device_for("4.4.4.4", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)") == ("Mac", "laptop")
    assert r.device_for("5.5.5.5", None) == ("5.5.5.5", "unknown")

def test_kind_is_remembered_across_requests(tmp_path):
    r = ClientRegistry(tmp_path / "config.json")
    r.device_for("9.9.9.9", "okhttp/4.12.0")     # identifies as phone
    # a later request from the same ip with no UA still knows the kind
    assert r.kind_for("9.9.9.9") == "phone"
    assert r.device_for("9.9.9.9", None)[1] == "phone"

def test_custom_label_keeps_detected_kind(tmp_path):
    r = ClientRegistry(tmp_path / "config.json")
    r.device_for("1.2.3.4", "iPhone")            # kind cached
    r.set_label("1.2.3.4", "Ahmad's iPhone")
    label, kind = r.device_for("1.2.3.4", "iPhone")
    assert label == "Ahmad's iPhone" and kind == "phone"

def test_set_label_persists(tmp_path):
    p = tmp_path / "config.json"
    ClientRegistry(p).set_label("1.1.1.1", "My iPhone")
    assert ClientRegistry(p).all_labels()["1.1.1.1"] == "My iPhone"

def test_explicit_label_wins_over_guess(tmp_path):
    r = ClientRegistry(tmp_path / "config.json")
    r.set_label("1.1.1.1", "Custom")
    assert r.label_for("1.1.1.1", "iPhone") == "Custom"

def test_corrupt_config_recovers_gracefully(tmp_path):
    p = tmp_path / "config.json"
    p.write_text("{not json")
    r = ClientRegistry(p)
    assert r.all_labels() == {}
    assert r.label_for("1.1.1.1", "iPhone") == "iPhone"

def test_passthrough_patterns_default_empty(tmp_path):
    r = ClientRegistry(tmp_path / "config.json")
    assert r.passthrough_patterns() == []

def test_passthrough_patterns_read_from_config(tmp_path):
    p = tmp_path / "config.json"
    p.write_text('{"passthrough_hosts": ["*.itunes.apple.com", "*.fbcdn.net"]}')
    r = ClientRegistry(p)
    assert r.passthrough_patterns() == ["*.itunes.apple.com", "*.fbcdn.net"]

def test_set_label_is_atomic_no_partial_file(tmp_path, monkeypatch):
    import os
    p = tmp_path / "config.json"
    r = ClientRegistry(p)
    calls = {"n": 0}
    real_replace = os.replace
    def spy(src, dst):
        calls["n"] += 1
        return real_replace(src, dst)
    monkeypatch.setattr("proxino.clients.os.replace", spy)
    r.set_label("1.1.1.1", "Phone")
    assert calls["n"] == 1                      # went through os.replace
    assert list(tmp_path.glob("*.tmp")) == []   # no leftover temp file
    assert ClientRegistry(p).all_labels()["1.1.1.1"] == "Phone"
