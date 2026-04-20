import { useMemo } from "react";
import { BUDGET, SLOW_TURN_MS, BUDGET_WARN_PCT, CTX_WARN_PCT } from "../../lib/constants";
import { useAgentView } from "../../store";
import { selectSelectedSession, selectBudgetPct, selectTotalCost, selectCtxPct, selectLatencyPoints, selectPendingForSession } from "../../store/selectors";
import type { PendingApproval } from "@agentview/shared";

function getPendingMessage(pending: PendingApproval[]): string {
  if (pending.length !== 1) return ` — ${pending.length} tool calls waiting for review`;
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
}

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

  const slowTurns = latencyPoints.filter((t) => t.latency > SLOW_TURN_MS);
  const hasSlowTurns = slowTurns.length > 0;
  const slowTurnCount = slowTurns.length;
  const noAlerts = pending.length === 0 && budgetPct <= BUDGET_WARN_PCT && ctxPct <= CTX_WARN_PCT && !hasSlowTurns;

  return (
    <>
      {pending.length > 0 && (
        <div className="alert alert-warn">
          <span className="aicon">⚠</span>
          <div className="abody">
            <strong>Approval pending</strong>
            {getPendingMessage(pending)}
          </div>
        </div>
      )}
      {budgetPct > BUDGET_WARN_PCT && (
        <div className="alert alert-warn">
          <span className="aicon">⚠</span>
          <div className="abody">
            <strong>Budget at {budgetPct.toFixed(0)}%</strong> — ${totalCost.toFixed(3)} of ${BUDGET} used across all sessions
          </div>
        </div>
      )}
      {ctxPct > CTX_WARN_PCT && (
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
