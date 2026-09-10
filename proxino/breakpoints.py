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


import time
from typing import Callable


class BreakpointEngine:
    def __init__(self, rules_provider: Callable[[], dict], timeout_s: float = 60.0,
                 now: Callable[[], float] = time.monotonic, wall: Callable[[], float] = time.time) -> None:
        self._rules_provider = rules_provider
        self.timeout_s = timeout_s
        self._now = now; self._wall = wall
        self._paused: dict[str, dict] = {}

    def _rules(self) -> tuple[bool, list[BreakpointRule]]:
        data = self._rules_provider() or {}
        rules = []
        for r in data.get("rules", []):
            try:
                rules.append(BreakpointRule.from_dict(r))
            except ValueError:
                continue
        return bool(data.get("enabled", True)), rules

    def should_pause(self, flow, phase: str, has_clients: bool) -> BreakpointRule | None:
        if not has_clients or getattr(flow, "is_replay", False):
            return None
        enabled, rules = self._rules()
        if not enabled:
            return None
        req = getattr(flow, "request", None)
        if req is None:
            return None
        path = req.path.split("?", 1)[0]
        return match_rule(rules, host=req.host, path=path, method=req.method, phase=phase)

    def public(self, entry: dict) -> dict:
        out = {k: v for k, v in entry.items() if not k.startswith("_")}
        # `deadline` is computed here from the *current* `timeout_s`, not
        # frozen at pause() time, so a later change to `timeout_s` (e.g. a
        # live settings update) is reflected immediately -- both in what
        # callers read and in what sweep() below treats as stale.
        out["deadline"] = entry["since"] + self.timeout_s
        return out

    def pause(self, flow, phase: str, rule: BreakpointRule | None) -> dict:
        flow.intercept()
        since = self._wall()
        entry = {"flow_id": flow.id, "phase": phase, "rule_id": rule.id if rule else None,
                 "since": since, "_flow": flow}
        self._paused[flow.id] = entry
        return self.public(entry)

    def get(self, flow_id: str) -> dict | None:
        e = self._paused.get(flow_id)
        return self.public(e) if e else None

    def paused(self) -> list[dict]:
        return [self.public(e) for e in self._paused.values()]

    def flow(self, flow_id: str):
        e = self._paused.get(flow_id)
        return e["_flow"] if e else None

    def resume(self, flow_id: str) -> dict | None:
        e = self._paused.pop(flow_id, None)
        if e is None:
            return None
        e["_flow"].resume()
        return self.public(e)

    def resume_all(self) -> list[dict]:
        """Resume every currently-paused flow (e.g. before the store that
        backs their /api/paused entries is cleared out from under them)."""
        out = []
        for fid in list(self._paused):
            e = self.resume(fid)
            if e:
                out.append(e)
        return out

    def drop(self, flow_id: str) -> dict | None:
        e = self._paused.pop(flow_id, None)
        if e is None:
            return None
        f = e["_flow"]
        killed = False
        if getattr(f, "killable", False):
            f.kill(); killed = True
        else:
            f.resume()
        out = self.public(e); out["killed"] = killed
        return out

    def sweep(self) -> list[dict]:
        now = self._wall()
        stale = [fid for fid, e in self._paused.items() if now - e["since"] >= self.timeout_s]
        out = []
        for fid in stale:
            e = self.resume(fid)
            if e:
                out.append(e)
        return out
