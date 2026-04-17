import { useMemo } from "react";
import TokenChart from "../charts/TokenChart";
import ContextPie from "../charts/ContextPie";
import { BUDGET, CTX_MAX } from "../../lib/constants";
import { useAgentView } from "../../store";
import { selectSelectedSession, selectTokenPoints, selectPendingForSession, selectCtxPct } from "../../store/selectors";

function MetricsTab() {
  const activeId = useAgentView((s) => s.activeId);
  const selectedSession = useAgentView(selectSelectedSession);
  const tokenPointsSelector = useMemo(() => selectTokenPoints(activeId ?? ""), [activeId]);
  const pendingSelector = useMemo(() => selectPendingForSession(activeId ?? ""), [activeId]);
  const ctxPctSelector = useMemo(() => selectCtxPct(activeId ?? ""), [activeId]);
  const tokenPoints = useAgentView(tokenPointsSelector);
  const pending = useAgentView(pendingSelector);
  const ctxPct = useAgentView(ctxPctSelector);
  const sendApprovalResponse = useAgentView((s) => s.sendApprovalResponse);

  if (!selectedSession) return null;

  const approval = pending[0] ?? null;

  return (
    <>
      {approval && (
        <div className="acard">
          <div className="ahdr">⚠ APPROVAL REQUIRED</div>
          <div className="acmd">$ {approval.tool_input}</div>
          <div className="abtns">
            <button className="btn approve" onClick={() => sendApprovalResponse(selectedSession.id, approval.tool_call_id, true)}>APPROVE</button>
            <button className="btn reject" onClick={() => sendApprovalResponse(selectedSession.id, approval.tool_call_id, false)}>REJECT</button>
          </div>
        </div>
      )}
      <div className="mrow">
        <div className="mcard">
          <div className="mlbl">Cost</div>
          <div className="mval" style={{ color: "var(--green)" }}>${selectedSession.total_cost_usd.toFixed(3)}</div>
          <div className="msub">of ${BUDGET} budget</div>
        </div>
        <div className="mcard">
          <div className="mlbl">Tokens</div>
          <div className="mval" style={{ color: "var(--blue)" }}>{(selectedSession.total_tokens / 1000).toFixed(1)}k</div>
          <div className="msub">of {CTX_MAX / 1000}k ctx</div>
        </div>
      </div>
      <div className="divider" />
      <TokenChart data={tokenPoints} />
      <div className="divider" />
      <ContextPie ctxPct={ctxPct} />
    </>
  );
}

export default MetricsTab;