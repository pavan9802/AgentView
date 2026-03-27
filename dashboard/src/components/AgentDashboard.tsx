import { useState, useEffect, useRef, useCallback } from "react";
import { BUDGET, CTX_MAX } from "../lib/constants";
import { randomInt, randomLatency } from "../lib/utils";
import { SEED_SESSIONS, makeToolCall, makeTurnMarker } from "../lib/mockData";
import { styles } from "../styles/dashboardStyles";
import type { Session } from "../lib/types";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import FeedPanel from "./FeedPanel";
import RightPanel from "./RightPanel";
import { useSessions } from "../hooks/useSessions";

export default function AgentDashboard() {
  const { startSession } = useSessions();
  const [sessions, setSessions] = useState<Session[]>(SEED_SESSIONS);
  const [activeId, setActiveId] = useState("s1");
  const [activeTab, setActiveTab] = useState("metrics");
  const feedRef = useRef<HTMLDivElement>(null);
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const activeIdRef = useRef(activeId);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Simulate a session
  const startSim = useCallback((id: string) => {
    if (intervalsRef.current[id]) return;
    intervalsRef.current[id] = setInterval(() => {
      setSessions((prev) => {
        const idx = prev.findIndex((x) => x.id === id);
        if (idx === -1) {
          clearInterval(intervalsRef.current[id]);
          return prev;
        }
        const s = prev[idx];
        if (!s || s.status !== "running") {
          clearInterval(intervalsRef.current[id]);
          delete intervalsRef.current[id];
          return prev;
        }

        const isActive = activeIdRef.current === id;
        const r = Math.random();
        let updated: Session;

        if (r < 0.12 && !s.pendingApproval) {
          const cmds = ["git commit -m 'fix: validation'", "rm -rf dist/", "npm run build", "npx prisma migrate deploy"] as const;
          updated = { ...s, pendingApproval: cmds[Math.floor(Math.random() * cmds.length)] ?? cmds[0], status2: "waiting" };
        } else if (r < 0.22) {
          const newTurn = s.turn + 1;
          const newTokens = Math.floor(s.tokens * 1.14 + randomInt(400, 900));
          updated = {
            ...s,
            turn: newTurn,
            tokens: newTokens,
            cost: +(s.cost + 0.005 + Math.random() * 0.004).toFixed(4),
            tokenHistory: [...s.tokenHistory, { turn: newTurn, tokens: newTokens }],
            turnLatency: [...s.turnLatency, { turn: newTurn, latency: randomLatency(), tokens: newTokens }],
            feed: [...s.feed, makeTurnMarker(newTurn)],
            status2: "thinking",
            unread: isActive ? 0 : s.unread + 1,
          };
        } else {
          updated = {
            ...s,
            feed: [...s.feed, makeToolCall()],
            status2: "executing",
            unread: isActive ? 0 : s.unread + 1,
          };
        }

        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    }, 2400);
  }, []);

  useEffect(() => {
    startSim("s1");
    return () => Object.values(intervalsRef.current).forEach(clearInterval);
  }, [startSim]);

  // Clear unread on switch
  useEffect(() => {
    setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, unread: 0 } : s)));
  }, [activeId]);

  // Auto-scroll feed to bottom
  useEffect(() => {
    const t = setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, 60);
    return () => clearTimeout(t);
  }, [activeId]);

  // useEffect(() => {
  //   if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  // }, [sessions.find((s) => s.id === activeId)?.feed?.length]);

  const handleSubmit = useCallback((prompt: string) => {
    void startSession(prompt.trim()).then((res) => {
      console.log("[agentview] session created", res);
    });
    const id = Math.random().toString(36).slice(2);
    const s: Session = {
      id,
      name: prompt,
      status: "running",
      status2: "thinking",
      feed: [makeTurnMarker(1)],
      turn: 1,
      cost: 0,
      tokens: 1800,
      tokenHistory: [{ turn: 1, tokens: 1800 }],
      turnLatency: [{ turn: 1, latency: randomLatency(), tokens: 1800 }],
      startedAt: Date.now(),
      unread: 0,
      pendingApproval: null,
    };
    setSessions((prev) => [s, ...prev]);
    setActiveId(id);
    setTimeout(() => startSim(id), 120);
  }, [startSim, startSession]);

  const handleApprove = useCallback((sid: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id !== sid
          ? s
          : {
              ...s,
              pendingApproval: null,
              status2: "executing",
              feed: [
                ...s.feed,
                {
                  id: Math.random().toString(36).slice(2),
                  type: "tool" as const,
                  tool: "Bash",
                  arg: s.pendingApproval ?? "",
                  ts: Date.now(),
                  duration: randomInt(1200, 4000),
                },
              ],
            },
      ),
    );
  }, []);

  const handleReject = useCallback((sid: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id !== sid ? s : { ...s, pendingApproval: null, status2: "thinking" })),
    );
  }, []);

  const active = sessions.find((s) => s.id === activeId);
  if (!active) return null;

  const totalCost = sessions.reduce((a, s) => a + s.cost, 0);
  const budgetPct = Math.min((totalCost / BUDGET) * 100, 100);
  const ctxPct = Math.min((active.tokens / CTX_MAX) * 100, 100);
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
        <Sidebar sessions={sessions} activeId={activeId} onSelect={setActiveId} />
        <FeedPanel
          active={active}
          ctxPct={ctxPct}
          feedRef={feedRef}
          onSubmit={handleSubmit}
        />
        <RightPanel
          active={active}
          activeId={activeId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
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
