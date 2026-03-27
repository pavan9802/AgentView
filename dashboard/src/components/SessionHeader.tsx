import { useState, useEffect, memo } from "react";
import type { Session } from "../lib/types";
import { fmtElapsed } from "../lib/utils";

interface SessionHeaderProps {
  selectedSession: Session;
  ctxPct: number;
}

const SessionHeader = memo(function SessionHeader({ selectedSession, ctxPct }: SessionHeaderProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (selectedSession.status !== "running") return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [selectedSession.status]);

  const elapsedSec = selectedSession.status === "running" ? Math.floor((Date.now() - selectedSession.startedAt) / 1000) : 0;

  return (
    <div className="thdr">
      <div className={`sdot ${selectedSession.status}`} />
      <div className="tname">{selectedSession.name}</div>
      <div className="tmeta">
        <span
          style={{
            color:
              selectedSession.status2 === "waiting"
                ? "var(--amber)"
                : selectedSession.status2 === "complete"
                  ? "var(--blue)"
                  : "var(--green)",
          }}
        >
          {selectedSession.status2}
        </span>
        <span style={{ color: "var(--text-muted)" }}>turn</span>
        <b>{selectedSession.turn}</b>
        <span style={{ color: "var(--text-muted)" }}>elapsed</span>
        <b>{fmtElapsed(elapsedSec)}</b>
        <span style={{ color: "var(--text-muted)" }}>ctx</span>
        <b style={{ color: ctxPct > 75 ? "var(--amber)" : "var(--green)" }}>{ctxPct.toFixed(1)}%</b>
      </div>
    </div>
  );
});

export default SessionHeader;
