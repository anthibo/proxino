from __future__ import annotations
from .models import Flow
from .store import FlowStore

def dump_session(store: FlowStore) -> list[dict]:
    return [store.get(m["id"]).model_dump() for m in store.list_meta()]

def load_session(store: FlowStore, flows: list[dict]) -> int:
    store.clear()
    parsed = [Flow(**f) for f in flows]
    for flow in reversed(parsed):   # list is newest-first; add oldest first
        store.add(flow)
    return len(parsed)
