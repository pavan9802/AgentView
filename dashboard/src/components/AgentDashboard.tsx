import { useState, useEffect, useRef, useCallback } from "react";
import { BUDGET, CTX_MAX } from "../lib/constants";
import { styles } from "../styles/dashboardStyles";
import type { Session } from "../lib/types";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import FeedPanel from "./FeedPanel";
import RightPanel from "./RightPanel";
import PromptBar from "./feed/PromptBar";
import { useSessions } from "../hooks/useSessions";

export default function AgentDashboard() {
  const { startSession } = useSessions();
  const [sessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll feed to bottom
  useEffect(() => {
    const t = setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, 60);
    return () => clearTimeout(t);
  }, [activeId]);

  const handleSubmit = useCallback((prompt: string) => {
    void startSession(prompt.trim()).then((res) => {
      console.log("[agentview] session created", res);
    });
  }, [startSession]);

  const handleApprove = useCallback((_sid: string) => {
    // wired to store in 4.3
  }, []);

  const handleReject = useCallback((_sid: string) => {
    // wired to store in 4.3
  }, []);

  const selectedSession = sessions.find((s) => s.id === (activeId ?? ""));

  if (!selectedSession) {
    return (
      <>
        <style>{styles}</style>
        <div className="dashboard">
          <Topbar runningCount={0} totalCost={0} sessionCount={sessions.length} budgetPct={0} />
          <Sidebar sessions={sessions} activeId={activeId ?? ""} onSelect={setActiveId} />
          <div className="main">
            <PromptBar onSubmit={handleSubmit} />
          </div>
        </div>
      </>
    );
  }

  const totalCost = sessions.reduce((a, s) => a + s.total_cost_usd, 0);
  const budgetPct = Math.min((totalCost / BUDGET) * 100, 100);
  const ctxPct = Math.min((selectedSession.total_tokens / CTX_MAX) * 100, 100);
  const runningCount = sessions.filter((s) => s.status === "running").length;

  return (
    <>
      <style>{styles}</style>
      <div className="dashboard">
        <Topbar
          runningCount={runningCount}
          totalCost={totalCost}
          sessionCount={sessions.length}
          budgetPct={budgetPct}
        />
        <Sidebar sessions={sessions} activeId={activeId ?? ""} onSelect={setActiveId} />
        <FeedPanel
          selectedSession={selectedSession}
          ctxPct={ctxPct}
          feedRef={feedRef}
          onSubmit={handleSubmit}
        />
        <RightPanel
          selectedSession={selectedSession}
          activeId={activeId ?? ""}
          onApprove={handleApprove}
          onReject={handleReject}
          budgetPct={budgetPct}
          totalCost={totalCost}
          ctxPct={ctxPct}
        />
      </div>
    </>
  );
}
