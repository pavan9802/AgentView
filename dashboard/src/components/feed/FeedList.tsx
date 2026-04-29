import { useRef, useEffect, useMemo } from "react";
import { fmtTs } from "../../lib/utils";
import { useAgentView } from "../../store";
import { selectFeedItems } from "../../store/selectors";

function FeedList() {
  const activeId = useAgentView((s) => s.activeId);
  const isRunning = useAgentView((s) => s.activeId != null && s.sessions[s.activeId]?.status === "running");
  const feedRef = useRef<HTMLDivElement>(null);
  const feedItemsSelector = useMemo(() => selectFeedItems(activeId ?? ""), [activeId]);
  const feedItems = useAgentView(feedItemsSelector);

  useEffect(() => {
    const t = setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, 60);
    return () => clearTimeout(t);
  }, [feedItems.length]);

  if (!activeId) return <div className="feed" />;

  return (
    <div className="feed" ref={feedRef}>
      {feedItems.map((item) => {
        if (item.type === "turn") {
          const showMetrics = item.input_tokens !== 0 || item.cost_usd !== 0;
          return (
            <div className="tmark" key={item.id}>
              TURN {item.turn}
              {showMetrics && (
                <span className="tmark-meta">
                  {item.input_tokens.toLocaleString()} tok · ${item.cost_usd.toFixed(4)}
                </span>
              )}
            </div>
          );
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
      {isRunning && (
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
