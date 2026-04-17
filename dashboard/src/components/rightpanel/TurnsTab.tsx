import { useMemo } from "react";
import TurnLatency from "../charts/TurnLatency";
import ToolUsage from "../charts/ToolUsage";
import { useAgentView } from "../../store";
import { selectLatencyPoints, selectToolUsage } from "../../store/selectors";

function TurnsTab() {
  const activeId = useAgentView((s) => s.activeId);
  const latencyPointsSelector = useMemo(() => selectLatencyPoints(activeId ?? ""), [activeId]);
  const toolUsageSelector = useMemo(() => selectToolUsage(activeId ?? ""), [activeId]);
  const latencyPoints = useAgentView(latencyPointsSelector);
  const toolUsage = useAgentView(toolUsageSelector);

  return (
    <>
      <TurnLatency turns={latencyPoints} />
      <div className="divider" />
      <ToolUsage feed={toolUsage} />
    </>
  );
}

export default TurnsTab;