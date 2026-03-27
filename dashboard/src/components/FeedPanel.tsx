import { useState } from "react";
import type React from "react";
import type { Session } from "../lib/types";
import { fmtTs } from "../lib/utils";
import SessionHeader from "./SessionHeader";

interface FeedPanelProps {
  selectedSession: Session;
  ctxPct: number;
  feedRef: React.RefObject<HTMLDivElement>;
  onSubmit: (prompt: string) => void;
}

export default function FeedPanel({
  selectedSession,
  ctxPct,
  feedRef,
  onSubmit,
}: FeedPanelProps) {

  const [prompt, setPrompt] = useState("");
  
  return (
    <div className="main">
      <SessionHeader selectedSession={selectedSession} ctxPct={ctxPct} />

      <div className="feed" ref={feedRef}>
        {selectedSession.feed.map((item) => {
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
        {selectedSession.status2 === "thinking" && (
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
