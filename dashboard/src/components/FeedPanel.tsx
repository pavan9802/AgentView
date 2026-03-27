import { useState } from "react";
import type React from "react";
import type { Session } from "../lib/types";
import { fmtTs, fmtElapsed } from "../lib/utils";

interface FeedPanelProps {
  active: Session;
  elapsedSec: number;
  ctxPct: number;
  feedRef: React.RefObject<HTMLDivElement>;
  onSubmit: (prompt: string) => void;
}

export default function FeedPanel({
  active,
  elapsedSec,
  ctxPct,
  feedRef,
  onSubmit,
}: FeedPanelProps) {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="main">
      <div className="thdr">
        <div className={`sdot ${active.status}`} />
        <div className="tname">{active.name}</div>
        <div className="tmeta">
          <span
            style={{
              color:
                active.status2 === "waiting"
                  ? "var(--amber)"
                  : active.status2 === "complete"
                    ? "var(--blue)"
                    : "var(--green)",
            }}
          >
            {active.status2}
          </span>
          <span style={{ color: "var(--text-muted)" }}>turn</span>
          <b>{active.turn}</b>
          <span style={{ color: "var(--text-muted)" }}>elapsed</span>
          <b>{fmtElapsed(elapsedSec)}</b>
          <span style={{ color: "var(--text-muted)" }}>ctx</span>
          <b style={{ color: ctxPct > 75 ? "var(--amber)" : "var(--green)" }}>{ctxPct.toFixed(1)}%</b>
        </div>
      </div>

      <div className="feed" ref={feedRef}>
        {active.feed.map((item) => {
          if (item.type === "turn") {
            return <div className="tmark" key={item.id}>TURN {item.turn}</div>;
          }
          return (
            <div className="fi" key={item.id}>
              <span className="fts">{fmtTs(item.ts)}</span>
              <span className={`ftool t-${item.tool}`}>{item.tool}</span>
              <span className="farg"><em>{item.arg}</em></span>
              <span className="fdur">{item.duration}ms</span>
            </div>
          );
        })}
        {active.status2 === "thinking" && (
          <div className="fi">
            <span className="fts">{fmtTs(Date.now())}</span>
            <span className="ftool t-thinking">···</span>
            <span className="farg" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>reasoning</span>
          </div>
        )}
      </div>

      <div className="pbar">
        <span className="ppfx">❯</span>
        <input
          className="pinput"
          placeholder="New session or inject mid-task instructions…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim()) { onSubmit(prompt); setPrompt(""); } }}
        />
        <button className="pbtn" onClick={() => { if (prompt.trim()) { onSubmit(prompt); setPrompt(""); } }} disabled={!prompt.trim()}>
          RUN
        </button>
      </div>
    </div>
  );
}
