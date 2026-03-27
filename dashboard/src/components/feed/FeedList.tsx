import type React from "react";
import type { Session } from "../../lib/types";
import { fmtTs } from "../../lib/utils";

interface FeedListProps {
  selectedSession: Session;
  feedRef: React.RefObject<HTMLDivElement>;
}

function FeedList({ selectedSession, feedRef }: FeedListProps) {
  return (
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
  );
};

export default FeedList;