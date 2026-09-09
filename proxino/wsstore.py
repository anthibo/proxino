"""Per-connection WebSocket frame buffer (capped) with lightweight previews."""
from __future__ import annotations
import json
from collections import deque
import msgpack
from proxino.decode import decode_body

MAX_TEXT = 65536
DEFAULT_CAP = 500


def _is_valid_msgpack(content: bytes) -> bool:
    """decode_body's underlying MsgPack view only validates a leading value and
    ignores trailing bytes (e.g. a lone 0xff byte is already a valid one-byte
    msgpack integer), so it can mis-classify arbitrary binary frames as msgpack.
    Gate on a strict single-value unpack that requires the whole buffer to be
    consumed before trusting that label."""
    try:
        msgpack.unpackb(content, raw=False)
        return True
    except Exception:
        return False


def _preview(is_text: bool, content: bytes) -> tuple[str | None, str | None, str | None]:
    """Return (text, view, pretty). Text frames try JSON; binary frames try msgpack then protobuf."""
    if is_text:
        text = content.decode("utf-8", errors="replace")
        try:
            parsed = json.loads(text)
        except ValueError:
            return text[:MAX_TEXT], None, None
        return text[:MAX_TEXT], "json", json.dumps(parsed, indent=2, ensure_ascii=False)
    if _is_valid_msgpack(content):
        decoded = decode_body(content, "application/msgpack")
        if decoded:
            return None, decoded[0], decoded[1]
    decoded = decode_body(content, "application/x-protobuf")
    if decoded:
        return None, decoded[0], decoded[1]
    return None, None, None


class WsStore:
    def __init__(self, cap: int = DEFAULT_CAP) -> None:
        self._cap = cap
        self._msgs: dict[str, deque[dict]] = {}
        self._count: dict[str, int] = {}

    def append(self, flow_id: str, from_client: bool, is_text: bool, content: bytes, ts: float) -> dict:
        i = self._count.get(flow_id, 0)
        text, view, pretty = _preview(is_text, content)
        msg = {"i": i, "t": ts, "dir": "out" if from_client else "in",
               "type": "text" if is_text else "binary", "size": len(content),
               "text": text, "view": view, "pretty": pretty}
        self._msgs.setdefault(flow_id, deque(maxlen=self._cap)).append(msg)
        self._count[flow_id] = i + 1
        return msg

    def get(self, flow_id: str, after: int = -1) -> tuple[list[dict], int]:
        msgs = self._msgs.get(flow_id)
        if not msgs:
            return [], 0
        return [m for m in msgs if m["i"] > after], self._count.get(flow_id, 0)

    def count(self, flow_id: str) -> int:
        return self._count.get(flow_id, 0)

    def evict(self, flow_id: str) -> None:
        self._msgs.pop(flow_id, None); self._count.pop(flow_id, None)

    def clear(self) -> None:
        self._msgs.clear(); self._count.clear()
