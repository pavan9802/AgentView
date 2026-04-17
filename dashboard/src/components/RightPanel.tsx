import { memo, useState } from "react";
import MetricsTab from "./rightpanel/MetricsTab";
import TurnsTab from "./rightpanel/TurnsTab";
import AlertsTab from "./rightpanel/AlertsTab";

const RightPanel = memo(() => {
  const [activeTab, setActiveTab] = useState("metrics");
  return (
    <div className="rp">
      <div className="ptabs">
        {(["metrics", "turns", "alerts"] as const).map((t) => (
          <div key={t} className={`ptab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>
            {t}
          </div>
        ))}
      </div>
      <div className="pbody">
        {activeTab === "metrics" && <MetricsTab />}
        {activeTab === "turns" && <TurnsTab />}
        {activeTab === "alerts" && <AlertsTab />}
      </div>
    </div>
  );
});

export default RightPanel;
