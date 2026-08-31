import { useEffect, useState } from "react";
import { TopBar } from "./components/TopBar";
import { FilterBar } from "./components/FilterBar";
import { ClientsSidebar } from "./components/ClientsSidebar";
import { FlowTable } from "./components/FlowTable";
import { DetailPane } from "./components/DetailPane";
import { StatusBar } from "./components/StatusBar";
import { ConnectDeviceModal } from "./components/ConnectDeviceModal";
import { connectWS } from "./ws";
import { fetchFlows } from "./api";
import { useStore } from "./store";
import "./theme.css";

export function App() {
  const [showConnect, setShowConnect] = useState(false);
  const upsert = useStore((s) => s.upsertFlow);
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
      <FilterBar />
      <div className="body">
        <ClientsSidebar />
        <FlowTable />
        <DetailPane />
      </div>
      <StatusBar />
      {showConnect && <ConnectDeviceModal onClose={() => setShowConnect(false)} />}
    </div>
  );
}
