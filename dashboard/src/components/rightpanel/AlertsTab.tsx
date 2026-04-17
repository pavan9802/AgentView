import { useMemo } from "react";
import { BUDGET } from "../../lib/constants";
import { useAgentView } from "../../store";
import { selectSelectedSession, selectBudgetPct, selectTotalCost, selectCtxPct, selectLatencyPoints, selectPendingForSession } from "../../store/selectors";

function AlertsTab() {
  const activeId = useAgentView((s) => s.activeId);
  const selectedSession = useAgentView(selectSelectedSession);
  const budgetPct = useAgentView(selectBudgetPct);
  const totalCost = useAgentView(selectTotalCost);
  const ctxPctSelector = useMemo(() => selectCtxPct(activeId ?? ""), [activeId]);
  const latencyPointsSelector = useMemo(() => selectLatencyPoints(activeId ?? ""), [activeId]);
  const pendingSelector = useMemo(() => selectPendingForSession(activeId ?? ""), [activeId]);
  const ctxPct = useAgentView(ctxPctSelector);
  const latencyPoints = useAgentView(latencyPointsSelector);
  const pending = useAgentView(pendingSelector);

  if (!selectedSession) return null;

  const hasSlowTurns = latencyPoints.some((t) => t.latency > 3000);
  const slowTurnCount = latencyPoints.filter((t) => t.latency > 3000).length;
  const noAlerts = pending.length === 0 && budgetPct <= 70 && ctxPct <= 60 && !hasSlowTurns;

  return (
    <>
      {pending.length > 0 && (
        <div className="alert alert-warn">
          <span className="aicon">⚠</span>
          <div className="abody">
            <strong>Approval pending</strong>
            {pending.length === 1
              ? (() => {
                  const p = pending[0];
                  if (!p) return " — tool call waiting for review";
                  if (p.tool_name === "bash") {
                    try {
                      const input = JSON.parse(p.tool_input) as Record<string, unknown>;
                      const cmd = typeof input["command"] === "string" ? input["command"] : null;
                      if (cmd) return ` — ${cmd.length > 60 ? cmd.slice(0, 60) + "…" : cmd}`;
                    } catch { /* fall through */ }
                  }
                  return ` — ${p.tool_name} waiting for review`;
                })()
              : ` — ${pending.length} tool calls waiting for review`}
          </div>
        </div>
      )}
      {budgetPct > 70 && (
        <div className="alert alert-warn">
          <span className="aicon">⚠</span>
          <div className="abody">
            <strong>Budget at {budgetPct.toFixed(0)}%</strong> — ${totalCost.toFixed(3)} of ${BUDGET} used across all sessions
          </div>
        </div>
      )}
      {ctxPct > 60 && (
        <div className="alert alert-warn">
          <span className="aicon">⚠</span>
          <div className="abody">
            <strong>Context {ctxPct.toFixed(0)}% full</strong> — compaction may occur soon on this session
          </div>
        </div>
      )}
      {hasSlowTurns && (
        <div className="alert alert-info">
          <span className="aicon">ℹ</span>
          <div className="abody">
            <strong>Slow turns detected</strong> — {slowTurnCount} turn(s) exceeded 3s on this session
          </div>
        </div>
      )}
      {noAlerts && <div className="empty">No active alerts</div>}
    </>
  );
}
export default AlertsTab;
