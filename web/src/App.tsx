import { useEffect, useState } from "react";
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
import { fetchFlows } from "./api";
import { useStore } from "./store";
import "./theme.css";

export function App() {
  const [showConnect, setShowConnect] = useState(false);
  const upsert = useStore((s) => s.upsertFlow);
  const view = useStore((s) => s.view);
  const isEmpty = useStore((s) => s.flows.size === 0);
  useEffect(() => {
    const resync = () => fetchFlows().then((fs) => fs.forEach(upsert)).catch(() => {});
    resync();
    return connectWS(
      (e) => { if ("flow" in e) upsert(e.flow); },
      resync,
    );
  }, [upsert]);
  return (
    <div className="app">
      <TopBar onConnect={() => setShowConnect(true)} />
      {view === "inspector" && <FilterBar />}
      <div className="body">
        {view === "inspector" ? (
          <>
            <ClientsSidebar />
            {isEmpty ? <EmptyState onConnect={() => setShowConnect(true)} /> : <><FlowTable /><DetailPane /></>}
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
