import { memo, useState } from "react";
import type { Session } from "../lib/types";
import MetricsTab from "./rightpanel/MetricsTab";
import TurnsTab from "./rightpanel/TurnsTab";
import AlertsTab from "./rightpanel/AlertsTab";

interface RightPanelProps {
  selectedSession: Session;
  activeId: string;
  onApprove: (sid: string) => void;
  onReject: (sid: string) => void;
  budgetPct: number;
  totalCost: number;
  ctxPct: number;
}

const RightPanel = memo(({
  selectedSession,
  activeId,
  onApprove,
  onReject,
  budgetPct,
  totalCost,
  ctxPct,
}: RightPanelProps) => {
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
        {activeTab === "metrics" && (
          <MetricsTab selectedSession={selectedSession} activeId={activeId} onApprove={onApprove} onReject={onReject} />
        )}
        {activeTab === "turns" && (
          <TurnsTab selectedSession={selectedSession} />
        )}
        {activeTab === "alerts" && (
          <AlertsTab selectedSession={selectedSession} budgetPct={budgetPct} totalCost={totalCost} ctxPct={ctxPct} />
        )}
      </div>
    </div>
  );
});

export default RightPanel;
