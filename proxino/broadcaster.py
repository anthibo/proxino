from __future__ import annotations
from typing import Any, Protocol

class WSLike(Protocol):
    async def send_json(self, data: dict) -> None: ...

class Broadcaster:
    def __init__(self) -> None:
        self._clients: set[Any] = set()

    async def register(self, ws: WSLike) -> None:
        self._clients.add(ws)

    def unregister(self, ws: WSLike) -> None:
        self._clients.discard(ws)

    async def publish(self, event: dict) -> None:
        dead = []
        for ws in list(self._clients):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)
