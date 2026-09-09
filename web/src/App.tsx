import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "./components/TopBar";
import { FilterBar } from "./components/FilterBar";
import { ClientsSidebar } from "./components/ClientsSidebar";
import { FlowTable } from "./components/FlowTable";
import { DetailPane } from "./components/DetailPane";
import { StatusBar } from "./components/StatusBar";
import { EmptyState } from "./components/EmptyState";
import { DevicesView } from "./components/DevicesView";
import { DashboardView } from "./components/DashboardView";
import { ConnectDeviceModal } from "./components/ConnectDeviceModal";
import { connectWS } from "./ws";
import { fetchFlows, fetchPassthrough } from "./api";
import { useStore } from "./store";
import "./theme.css";

export function App() {
  const [showConnect, setShowConnect] = useState(false);
  const upsert = useStore((s) => s.upsertFlow);
  const setPassthrough = useStore((s) => s.setPassthrough);
  const view = useStore((s) => s.view);
  const isEmpty = useStore((s) => s.flows.size === 0);
  const detailWidth = useStore((s) => s.detailWidth);
  const setDetailWidth = useStore((s) => s.setDetailWidth);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    dragState.current = { startX: e.clientX, startWidth: useStore.getState().detailWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const delta = dragState.current.startX - ev.clientX;
      setDetailWidth(dragState.current.startWidth + delta);
    };
    const onMouseUp = () => {
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [setDetailWidth]);

  useEffect(() => {
    // Re-clamp on resize: a pane sized against a wide window can otherwise
    // stay pinned past the 60%-of-viewport cap after the window shrinks.
    const onResize = () => setDetailWidth(useStore.getState().detailWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setDetailWidth]);
  useEffect(() => {
    // Running inside the Tauri desktop shell on macOS (seamless title bar) —
    // leave room for the macOS traffic-light buttons in the top bar. Other
    // platforms' Tauri windows use a normal title bar, so skip the padding.
    const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
    if ((w.__TAURI_INTERNALS__ || w.__TAURI__) && isMac) document.body.classList.add("in-tauri");
  }, []);
  useEffect(() => {
    const resync = () => {
      fetchFlows().then((fs) => fs.forEach(upsert)).catch(() => {});
      fetchPassthrough().then(setPassthrough).catch(() => {});
    };
    resync();
    return connectWS(
      (e) => {
        if ("flow" in e) upsert(e.flow);
        else if (e.type === "passthrough.update") setPassthrough(e.hosts);
      },
      resync,
    );
  }, [upsert, setPassthrough]);
  return (
    <div className="app">
      <TopBar onConnect={() => setShowConnect(true)} />
      {view === "inspector" && <FilterBar />}
      <div className="body">
        {view === "inspector" ? (
          <>
            <ClientsSidebar />
            {isEmpty ? <EmptyState onConnect={() => setShowConnect(true)} /> : (
              <>
                <FlowTable />
                <div
                  className="splitter"
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={onSplitterMouseDown}
                />
                <DetailPane width={detailWidth} />
              </>
            )}
          </>
        ) : view === "devices" ? (
          <DevicesView onConnect={() => setShowConnect(true)} />
        ) : (
          <DashboardView />
        )}
      </div>
      <StatusBar />
      {showConnect && <ConnectDeviceModal onClose={() => setShowConnect(false)} />}
    </div>
  );
}
