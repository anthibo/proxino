"""Breakpoint rules and matching. Engine (pause bookkeeping) is added in Task 2."""
from __future__ import annotations
import fnmatch
from dataclasses import dataclass, asdict

PHASES = ("request", "response", "both")


@dataclass
class BreakpointRule:
    id: str
    enabled: bool = True
    host: str = ""
    path: str = ""
    method: str = ""
    phase: str = "both"

    @classmethod
    def from_dict(cls, d: dict) -> "BreakpointRule":
        rid = d.get("id")
        if not isinstance(rid, str) or not rid:
            raise ValueError("rule id is required")
        phase = d.get("phase", "both")
        if phase not in PHASES:
            raise ValueError(f"phase must be one of {PHASES}")
        return cls(id=rid, enabled=bool(d.get("enabled", True)), host=str(d.get("host", "")),
                   path=str(d.get("path", "")), method=str(d.get("method", "")).upper(), phase=phase)

    def to_dict(self) -> dict:
        return asdict(self)

    def matches(self, *, host: str, path: str, method: str, phase: str) -> bool:
        if not self.enabled or (self.phase != "both" and self.phase != phase):
            return False
        if self.method and self.method != method.upper():
            return False
        if self.host and not fnmatch.fnmatch(host.lower(), self.host.lower()):
            return False
        if self.path and not fnmatch.fnmatch(path.lower(), self.path.lower()):
            return False
        return True


def match_rule(rules: list[BreakpointRule], *, host: str, path: str, method: str, phase: str) -> BreakpointRule | None:
    for r in rules:
        if r.matches(host=host, path=path, method=method, phase=phase):
            return r
    return None
