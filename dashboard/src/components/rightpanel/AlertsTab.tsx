import { BUDGET } from "../../lib/constants";
import type { Session } from "../../lib/types";

interface AlertsTabProps {
  selectedSession: Session;
  budgetPct: number;
  totalCost: number;
  ctxPct: number;
}

export default function AlertsTab({ selectedSession, budgetPct, totalCost, ctxPct }: AlertsTabProps) {
  const hasSlowTurns = selectedSession.turnLatency.some((t) => t.latency > 3000);
  const slowTurnCount = selectedSession.turnLatency.filter((t) => t.latency > 3000).length;
  const noAlerts = !selectedSession.pendingApproval && budgetPct <= 70 && ctxPct <= 60 && !hasSlowTurns;

  return (
    <>
      {selectedSession.pendingApproval && (
        <div className="alert alert-warn">
          <span className="aicon">⚠</span>
          <div className="abody"><strong>Approval pending</strong> — Bash command waiting for review</div>
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
