from __future__ import annotations
from collections import OrderedDict
from .models import Flow

class FlowStore:
    def __init__(self, capacity: int = 5000) -> None:
        self.capacity = capacity
        self._flows: OrderedDict[str, Flow] = OrderedDict()

    def add(self, flow: Flow) -> None:
        self._flows[flow.id] = flow
        self._flows.move_to_end(flow.id)
        while len(self._flows) > self.capacity:
            self._flows.popitem(last=False)

    def get(self, flow_id: str) -> Flow | None:
        return self._flows.get(flow_id)

    def list_meta(self) -> list[dict]:
        return [f.meta() for f in reversed(self._flows.values())]

    def clear(self) -> None:
        self._flows.clear()

    def client_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for f in self._flows.values():
            counts[f.client.ip] = counts.get(f.client.ip, 0) + 1
        return counts

    def __len__(self) -> int:
        return len(self._flows)
