import pytest
from proxino.broadcaster import Broadcaster

class FakeWS:
    def __init__(self, fail=False):
        self.sent = []
        self.fail = fail
    async def send_json(self, data):
        if self.fail:
            raise RuntimeError("closed")
        self.sent.append(data)

@pytest.mark.asyncio
async def test_publish_fans_out_and_drops_dead():
    b = Broadcaster()
    good, dead = FakeWS(), FakeWS(fail=True)
    await b.register(good); await b.register(dead)
    await b.publish({"type": "flow.new", "flow": {"id": "x"}})
    assert good.sent == [{"type": "flow.new", "flow": {"id": "x"}}]
    await b.publish({"type": "ping"})     # dead one already removed
    assert len(good.sent) == 2
