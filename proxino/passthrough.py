from __future__ import annotations
import time
from fnmatch import fnmatch


class PassthroughRegistry:
    """Tracks hosts whose TLS handshakes should be forwarded encrypted,
    either because their app pins certs and keeps refusing ours (auto),
    or because they were pre-listed in config (config)."""

    def __init__(self, patterns: list[str] = (), threshold: int = 2,
                 window_s: float = 60.0, now=time.monotonic) -> None:
        self._patterns = list(patterns)
        self._threshold = threshold
        self._window_s = window_s
        self._now = now
        # host -> list of (monotonic_ts, client_ip)
        self._failures: dict[str, list[tuple[float, str]]] = {}
        self._auto: set[str] = set()
        # host -> {"failures": int, "clients": set[str], "first_seen": float, "last_seen": float}
        self._entries: dict[str, dict] = {}
        # config-pattern hosts, tracked once actually seen
        self._config_seen: set[str] = set()

    def _touch(self, host: str, client_ip: str | None) -> None:
        wall = time.time()
        entry = self._entries.setdefault(host, {
            "failures": 0, "clients": set(), "first_seen": wall, "last_seen": wall,
        })
        entry["failures"] += 1
        if client_ip:
            entry["clients"].add(client_ip)
        entry["last_seen"] = wall

    def record_failure(self, host: str, client_ip: str) -> bool:
        now = self._now()
        events = self._failures.setdefault(host, [])
        events.append((now, client_ip))
        cutoff = now - self._window_s
        events[:] = [e for e in events if e[0] >= cutoff]
        self._touch(host, client_ip)
        was_active = host in self._auto
        if not was_active and len(events) >= self._threshold:
            self._auto.add(host)
            return True
        return False

    def _matches_pattern(self, host: str) -> bool:
        low = host.lower()
        return any(fnmatch(low, p.lower()) for p in self._patterns)

    def should_ignore(self, host: str | None) -> bool:
        if host is None:
            return False
        if host in self._auto:
            return True
        if self._matches_pattern(host):
            self._config_seen.add(host)
            self._touch(host, None)
            return True
        return False

    def remove(self, host: str) -> bool:
        was_active = host in self._auto
        self._auto.discard(host)
        self._failures.pop(host, None)
        self._entries.pop(host, None)
        self._config_seen.discard(host)
        return was_active

    def snapshot(self) -> list[dict]:
        out = []
        for host, entry in self._entries.items():
            source = "config" if host in self._config_seen else "auto"
            out.append({
                "host": host,
                "source": source,
                "failures": entry["failures"],
                "clients": sorted(entry["clients"]),
                "first_seen": entry["first_seen"],
                "last_seen": entry["last_seen"],
            })
        out.sort(key=lambda e: e["last_seen"], reverse=True)
        return out
