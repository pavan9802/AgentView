import TokenChart from "../charts/TokenChart";
import ContextPie from "../charts/ContextPie";
import { BUDGET, CTX_MAX } from "../../lib/constants";
import type { Session } from "../../lib/types";

interface MetricsTabProps {
  selectedSession: Session;
  activeId: string;
  onApprove: (sid: string) => void;
  onReject: (sid: string) => void;
}

export default function MetricsTab({ selectedSession, activeId, onApprove, onReject }: MetricsTabProps) {
  return (
    <>
      {selectedSession.pendingApproval && (
        <div className="acard">
          <div className="ahdr">⚠ APPROVAL REQUIRED</div>
          <div className="acmd">$ {selectedSession.pendingApproval}</div>
          <div className="abtns">
            <button className="btn approve" onClick={() => onApprove(activeId)}>APPROVE</button>
            <button className="btn reject" onClick={() => onReject(activeId)}>REJECT</button>
          </div>
        </div>
      )}
      <div className="mrow">
        <div className="mcard">
          <div className="mlbl">Cost</div>
          <div className="mval" style={{ color: "var(--green)" }}>${selectedSession.cost.toFixed(3)}</div>
          <div className="msub">of ${BUDGET} budget</div>
        </div>
        <div className="mcard">
          <div className="mlbl">Tokens</div>
          <div className="mval" style={{ color: "var(--blue)" }}>{(selectedSession.tokens / 1000).toFixed(1)}k</div>
          <div className="msub">of {CTX_MAX / 1000}k ctx</div>
        </div>
      </div>
      <div className="divider" />
      <TokenChart data={selectedSession.tokenHistory} />
      <div className="divider" />
      <ContextPie tokens={selectedSession.tokens} />
    </>
  );
}
