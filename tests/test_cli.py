from proxino.cli import build_argv
from proxino.paths import addon_path

ADDON = str(addon_path())

def test_defaults_inject_addon_and_ports():
    assert build_argv([], {}) == ["-s", ADDON, "-p", "8080", "--set", "proxino_web_port=8081"]

def test_flags_override_defaults():
    out = build_argv(["--proxy-port", "9090", "--web-port", "9091"], {})
    assert out == ["-s", ADDON, "-p", "9090", "--set", "proxino_web_port=9091"]

def test_env_overrides_defaults_but_flags_win():
    env = {"PROXINO_PROXY_PORT": "7000", "PROXINO_WEB_PORT": "7001"}
    assert build_argv([], env)[3] == "7000"
    assert build_argv(["--web-port", "1"], env)[-1] == "proxino_web_port=1"

def test_passthrough_keeps_user_mitmdump_args():
    out = build_argv(["--set", "termlog_verbosity=warn", "-q"], {})
    assert out[:2] == ["--set", "termlog_verbosity=warn"]
    assert "-q" in out and "-s" in out and "-p" in out

def test_user_supplied_script_and_port_are_not_duplicated():
    out = build_argv(["-s", "x.py", "-p", "1234"], {})
    assert out.count("-s") == 1 and out.count("-p") == 1
    assert out[:4] == ["-s", "x.py", "-p", "1234"]
