import { useState, useEffect, useMemo } from "react";
import { fmtElapsed } from "../../lib/utils";
import { useAgentView } from "../../store";
import { selectSelectedSession, selectCtxPct } from "../../store/selectors";

function SessionHeader() {
  const activeId = useAgentView((s) => s.activeId);
  const selectedSession = useAgentView(selectSelectedSession);
  const ctxPctSelector = useMemo(() => selectCtxPct(activeId ?? ""), [activeId]);
  const ctxPct = useAgentView(ctxPctSelector);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (selectedSession?.status !== "running") return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [selectedSession?.status]);

  if (!selectedSession) return null;

  const elapsedSec = selectedSession.status === "running" && selectedSession.started_at != null
    ? Math.floor((Date.now() - selectedSession.started_at) / 1000)
    : 0;

  const statusColor =
    selectedSession.status === "running"
      ? "var(--green)"
      : selectedSession.status === "complete"
        ? "var(--blue)"
        : "var(--amber)";

  return (
    <div className="thdr">
      <div className={`sdot ${selectedSession.status}`} />
      <div className="tname">{selectedSession.prompt}</div>
      <div className="tmeta">
        <span style={{ color: statusColor }}>{selectedSession.status}</span>
        <span style={{ color: "var(--text-muted)" }}>turn</span>
        <b>{selectedSession.total_turns}</b>
        <span style={{ color: "var(--text-muted)" }}>elapsed</span>
        <b>{fmtElapsed(elapsedSec)}</b>
        <span style={{ color: "var(--text-muted)" }}>ctx</span>
        <b style={{ color: ctxPct > 75 ? "var(--amber)" : "var(--green)" }}>{ctxPct.toFixed(1)}%</b>
      </div>
    </div>
  );
};

export default SessionHeader;
