import struct

from mitmproxy.test import tutils

from proxino.decode import decode_body


def test_decode_protobuf():
    result = decode_body(b"\x08\x96\x01", "application/x-protobuf")
    assert result is not None
    label, text = result
    assert label == "protobuf"
    assert "150" in text


def test_decode_grpc():
    msg = b"\x08\x96\x01"
    frame = b"\x00" + struct.pack(">I", len(msg)) + msg
    result = decode_body(frame, "application/grpc")
    assert result is not None
    label, text = result
    assert label == "grpc"
    assert "150" in text


def test_decode_msgpack():
    result = decode_body(b"\x81\xa1a\x01", "application/msgpack")
    assert result is not None
    label, text = result
    assert label == "msgpack"
    assert "a" in text
    assert "1" in text


def test_decode_urlencoded():
    result = decode_body(b"a=1&b=two", "application/x-www-form-urlencoded")
    assert result is not None
    label, text = result
    assert label == "form"
    assert "two" in text


def test_decode_multipart():
    body = (
        b"--BOUNDARY\r\n"
        b'Content-Disposition: form-data; name="f"\r\n\r\n'
        b"val\r\n--BOUNDARY--\r\n"
    )
    ct = "multipart/form-data; boundary=BOUNDARY"
    req = tutils.treq(content=body, headers=((b"content-type", ct.encode()),))
    result = decode_body(body, ct, message=req)
    assert result is not None
    label, _text = result
    assert label == "multipart"


def test_decode_unknown_type_returns_none():
    assert decode_body(b"hello world", "text/plain") is None


def test_decode_garbage_protobuf_returns_none_no_raise():
    assert decode_body(b"\xff\xff\xff garbage not protobuf \x00", "application/x-protobuf") is None


def test_decode_empty_body_returns_none():
    assert decode_body(b"", "application/x-protobuf") is None
    assert decode_body(None, "application/x-protobuf") is None
