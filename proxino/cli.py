"""`proxino` console entry point and the desktop sidecar entry.

Translates Proxino's own flags into mitmdump arguments and always loads the
addon, so `proxino`, `proxino --proxy-port 9090`, and the frozen sidecar all
behave the same. Any other argument is passed through to mitmdump untouched.
"""
from __future__ import annotations
import argparse
import os
import sys
from collections.abc import Mapping

from proxino.paths import addon_path

DEFAULT_PROXY_PORT = 8080
DEFAULT_WEB_PORT = 8081


def _has_option(rest: list[str], names: tuple[str, ...]) -> bool:
    """True if `rest` already contains one of `names`, in either
    `--flag value` / `-f value` or `--flag=value` form."""
    return any(
        tok in names or tok.startswith(tuple(n + "=" for n in names if n.startswith("--")))
        for tok in rest
    )


def build_argv(argv: list[str], env: Mapping[str, str]) -> list[str]:
    parser = argparse.ArgumentParser(prog="proxino", add_help=False, allow_abbrev=False)
    parser.add_argument("--proxy-port", type=int,
                        default=int(env.get("PROXINO_PROXY_PORT", DEFAULT_PROXY_PORT)))
    parser.add_argument("--web-port", type=int,
                        default=int(env.get("PROXINO_WEB_PORT", DEFAULT_WEB_PORT)))
    ns, rest = parser.parse_known_args(argv)
    out = list(rest)
    if not _has_option(rest, ("-s", "--scripts")):
        out += ["-s", str(addon_path())]
    if not _has_option(rest, ("-p", "--listen-port")):
        out += ["-p", str(ns.proxy_port)]
    out += ["--set", f"proxino_web_port={ns.web_port}"]
    return out


def main() -> None:
    from mitmproxy.tools.main import mitmdump
    sys.argv[1:] = build_argv(sys.argv[1:], os.environ)
    mitmdump()


if __name__ == "__main__":
    main()
