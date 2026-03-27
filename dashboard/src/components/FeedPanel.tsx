import type React from "react";
import type { Session } from "../lib/types";
import { fmtTs } from "../lib/utils";
import SessionHeader from "./SessionHeader";
import PromptBar from "./PromptBar";

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

      <PromptBar onSubmit={onSubmit} />
    </div>
  );
}
