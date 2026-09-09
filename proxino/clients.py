from __future__ import annotations
import json
import os
import tempfile
from pathlib import Path

# (User-Agent needle, display name, device kind). Order matters — most
# specific first. Covers browsers and native app HTTP stacks (CFNetwork/
# Darwin = iOS apps, okhttp/Dalvik = Android apps) so app traffic still
# resolves to a real device instead of a bare IP.
_DEVICES = [
    ("iPad", "iPad", "tablet"),
    ("iPhone", "iPhone", "phone"),
    ("Simulator", "iOS Simulator", "phone"),
    ("Android", "Android", "phone"),
    ("okhttp", "Android app", "phone"),
    ("Dalvik", "Android app", "phone"),
    ("CFNetwork", "iOS app", "phone"),
    ("Darwin", "iOS app", "phone"),
    ("Macintosh", "Mac", "laptop"),
    ("Mac OS X", "Mac", "laptop"),
    ("Windows", "Windows", "desktop"),
    ("Linux", "Linux", "desktop"),
]

class ClientRegistry:
    def __init__(self, config_path: Path) -> None:
        self.config_path = Path(config_path)
        self._kinds: dict[str, str] = {}  # first identified device kind per ip
        data = self._read_config()
        self._labels: dict[str, str] = data.get("labels", {})
        self._passthrough_patterns = data.get("passthrough_hosts", [])

    def _read_config(self) -> dict:
        """Load the config file as-is, tolerating a missing or corrupt file."""
        if not self.config_path.exists():
            return {}
        try:
            return json.loads(self.config_path.read_text() or "{}")
        except json.JSONDecodeError:
            return {}

    def device_for(self, ip: str, user_agent: str | None = None) -> tuple[str, str]:
        """Return (label, kind) for a client, remembering the first kind seen."""
        name = None
        kind = self._kinds.get(ip, "unknown")
        if user_agent:
            for needle, nm, kd in _DEVICES:
                if needle in user_agent:
                    name = nm
                    if kind == "unknown":
                        kind = kd
                    break
        if kind != "unknown":
            self._kinds[ip] = kind
        label = self._labels.get(ip) or name or ip
        return label, kind

    def label_for(self, ip: str, user_agent: str | None = None) -> str:
        return self.device_for(ip, user_agent)[0]

    def kind_for(self, ip: str) -> str:
        return self._kinds.get(ip, "unknown")

    def set_label(self, ip: str, label: str) -> None:
        self._labels[ip] = label
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        # Read-modify-write: reload whatever is on disk right now (it may
        # have been edited by hand, e.g. passthrough_hosts) and only
        # overwrite the "labels" key, so every other top-level key survives.
        on_disk = self._read_config()
        on_disk["labels"] = self._labels
        payload = json.dumps(on_disk, indent=2)
        fd, tmp = tempfile.mkstemp(dir=self.config_path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(payload)
            os.replace(tmp, self.config_path)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    def all_labels(self) -> dict[str, str]:
        return dict(self._labels)

    def passthrough_patterns(self) -> list[str]:
        return list(self._passthrough_patterns)
