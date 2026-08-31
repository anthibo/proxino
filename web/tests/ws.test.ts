import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { connectWS } from "../src/ws";

class FakeWS {
  static instances: FakeWS[] = [];
  onmessage: any; onclose: any; onerror: any; onopen: any;
  closed = false;
  constructor(public url: string) { FakeWS.instances.push(this); }
  close() { this.closed = true; }
}

beforeEach(() => { FakeWS.instances = []; (globalThis as any).WebSocket = FakeWS as any; vi.useFakeTimers();
  (globalThis as any).location = { protocol: "http:", host: "x" }; });
afterEach(() => vi.useRealTimers());

describe("connectWS reconnect", () => {
  it("reconnects after a close and fires onReconnect", () => {
    const onReconnect = vi.fn();
    connectWS(() => {}, onReconnect);
    expect(FakeWS.instances.length).toBe(1);
    FakeWS.instances[0].onclose?.();        // socket drops
    vi.advanceTimersByTime(1000);            // first backoff
    expect(FakeWS.instances.length).toBe(2); // reconnected
    FakeWS.instances[1].onopen?.();          // open triggers onReconnect
    expect(onReconnect).toHaveBeenCalled();
  });
  it("disposer stops reconnection", () => {
    const stop = connectWS(() => {});
    stop();
    FakeWS.instances[0].onclose?.();
    vi.advanceTimersByTime(10000);
    expect(FakeWS.instances.length).toBe(1); // no reconnect after dispose
  });
  it("disposer cancels a pending reconnect timer scheduled by a prior close", () => {
    const stop = connectWS(() => {});
    FakeWS.instances[0].onclose?.();          // schedules reconnect timer
    stop();                                    // dispose AFTER close, BEFORE timer fires
    vi.advanceTimersByTime(10000);
    expect(FakeWS.instances.length).toBe(1);   // ghost reconnect must not happen
  });
});
