import TokenChart from "./charts/TokenChart";
import ContextPie from "./charts/ContextPie";
import TurnLatency from "./charts/TurnLatency";
import ToolUsage from "./charts/ToolUsage";
import { BUDGET, CTX_MAX } from "../lib/constants";
import type { Session } from "../lib/types";

interface RightPanelProps {
  active: Session;
  activeId: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onApprove: (sid: string) => void;
  onReject: (sid: string) => void;
  budgetPct: number;
  totalCost: number;
  ctxPct: number;
}

export default function RightPanel({
  active,
  activeId,
  activeTab,
  onTabChange,
  onApprove,
  onReject,
  budgetPct,
  totalCost,
  ctxPct,
}: RightPanelProps) {
  return (
    <div className="rp">
      <div className="ptabs">
        {(["metrics", "turns", "alerts"] as const).map((t) => (
          <div key={t} className={`ptab${activeTab === t ? " active" : ""}`} onClick={() => onTabChange(t)}>
            {t}
          </div>
        ))}
      </div>
      <div className="pbody">

        {activeTab === "metrics" && (
          <>
            {active.pendingApproval && (
              <div className="acard">
                <div className="ahdr">⚠ APPROVAL REQUIRED</div>
                <div className="acmd">$ {active.pendingApproval}</div>
                <div className="abtns">
                  <button className="btn approve" onClick={() => onApprove(activeId)}>APPROVE</button>
                  <button className="btn reject" onClick={() => onReject(activeId)}>REJECT</button>
                </div>
              </div>
            )}
            <div className="mrow">
              <div className="mcard">
                <div className="mlbl">Cost</div>
                <div className="mval" style={{ color: "var(--green)" }}>${active.cost.toFixed(3)}</div>
                <div className="msub">of ${BUDGET} budget</div>
              </div>
              <div className="mcard">
                <div className="mlbl">Tokens</div>
                <div className="mval" style={{ color: "var(--blue)" }}>{(active.tokens / 1000).toFixed(1)}k</div>
                <div className="msub">of {CTX_MAX / 1000}k ctx</div>
              </div>
            </div>
            <div className="divider" />
            <TokenChart data={active.tokenHistory} />
            <div className="divider" />
            <ContextPie tokens={active.tokens} />
          </>
        )}

        {activeTab === "turns" && (
          <>
            <TurnLatency turns={active.turnLatency} />
            <div className="divider" />
            <ToolUsage feed={active.feed} />
          </>
        )}

        {activeTab === "alerts" && (
          <>
            {active.pendingApproval && (
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
            {active.turnLatency.some((t) => t.latency > 3000) && (
              <div className="alert alert-info">
                <span className="aicon">ℹ</span>
                <div className="abody">
                  <strong>Slow turns detected</strong> — {active.turnLatency.filter((t) => t.latency > 3000).length} turn(s) exceeded 3s on this session
                </div>
              </div>
            )}
            {!active.pendingApproval && budgetPct <= 70 && ctxPct <= 60 && !active.turnLatency.some((t) => t.latency > 3000) && (
              <div className="empty">No active alerts</div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
