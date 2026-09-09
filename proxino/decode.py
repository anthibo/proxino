from __future__ import annotations

from mitmproxy import contentviews as cv

# (content-type prefix or exact, mitmproxy view name, short label)
VIEW_BY_TYPE = [
    ("application/grpc", "gRPC", "grpc"),
    ("application/x-protobuf", "Protobuf", "protobuf"),
    ("application/protobuf", "Protobuf", "protobuf"),
    ("application/vnd.google.protobuf", "Protobuf", "protobuf"),
    ("application/msgpack", "MsgPack", "msgpack"),
    ("application/x-msgpack", "MsgPack", "msgpack"),
    ("multipart/form-data", "Multipart Form", "multipart"),
    ("application/x-www-form-urlencoded", "URL-encoded", "form"),
]


def decode_body(raw: bytes | None, content_type: str | None, message=None) -> tuple[str, str] | None:
    """Return (label, pretty_text) for content-types we can decode, else None.

    Never raises: any lookup or decode failure results in None.
    """
    if not raw:
        return None
    ct = (content_type or "").split(";")[0].strip().lower()
    if not ct:
        return None
    for prefix, view_name, label in VIEW_BY_TYPE:
        if ct == prefix or ct.startswith(prefix):
            try:
                view = cv.registry.get(view_name)
                if view is None:
                    continue
                result = view.prettify(raw, cv.Metadata(content_type=content_type, http_message=message))
                text = result if isinstance(result, str) else str(getattr(result, "text", result))
                if not text:
                    continue
                return label, text
            except Exception:
                return None
    return None
