import { useRef, useEffect, useMemo, useState } from "react";
import { fmtTs } from "../../lib/utils";
import { useAgentView } from "../../store";
import { selectFeedItems } from "../../store/selectors";
import type { FeedItem } from "../../lib/types";

const REASONING_WORDS = [
  "thinking",
  "reasoning",
  "planning",
  "reflecting",
  "pondering",
  "considering",
  "analyzing",
  "deliberating",
  "synthesizing",
  "processing",
  "inferring",
  "evaluating",
];

function useTypewriter(words: readonly string[], typeSpeed = 75, eraseSpeed = 45, pauseMs = 1600) {
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "erasing">("typing");
  const word = words[wordIdx % words.length] ?? "";

  useEffect(() => {
    if (phase === "typing") {
      if (charIdx < word.length) {
        const id = setTimeout(() => setCharIdx((c) => c + 1), typeSpeed);
        return () => clearTimeout(id);
      }
      const id = setTimeout(() => setPhase("erasing"), pauseMs);
      return () => clearTimeout(id);
    }
    // erasing
    if (charIdx > 0) {
      const id = setTimeout(() => setCharIdx((c) => c - 1), eraseSpeed);
      return () => clearTimeout(id);
    }
    setWordIdx((i) => i + 1);
    setPhase("typing");
  }, [phase, charIdx, word, typeSpeed, eraseSpeed, pauseMs]);

  return word.slice(0, charIdx);
}

function ReasoningLabel({ feedItems }: { feedItems: FeedItem[] }) {
  const label = useTypewriter(REASONING_WORDS);
  const [elapsed, setElapsed] = useState(0);

  const startMs = useMemo(() => {
    for (let i = feedItems.length - 1; i >= 0; i--) {
      const item = feedItems[i];
      if (item != null && item.type === "tool") return item.ts + item.duration;
    }
    return Date.now();
  }, [feedItems]); // recalculates when a tool finishes so the timer resets to ~0

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return (
    <>
      <span className="farg reasoning-text">
        {label}<span className="reasoning-cursor" />
      </span>
      <span className="fdur reasoning-timer">{elapsed}s</span>
    </>
  );
}

function FeedList() {
  const activeId = useAgentView((s) => s.activeId);
  const isRunning = useAgentView((s) => s.activeId != null && s.sessions[s.activeId]?.status === "running");
  const resultText = useAgentView((s) => s.activeId != null && s.sessions[s.activeId]?.status === "complete" ? s.sessions[s.activeId]?.result_text ?? null : null);
  const feedRef = useRef<HTMLDivElement>(null);
  const feedItemsSelector = useMemo(() => selectFeedItems(activeId ?? ""), [activeId]);
  const feedItems = useAgentView(feedItemsSelector);

  useEffect(() => {
    const t = setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, 60);
    return () => clearTimeout(t);
  }, [feedItems.length, resultText]);

  if (!activeId) return <div className="feed" />;

  return (
    <div className="feed" ref={feedRef}>
      {feedItems.map((item) => {
        if (item.type === "prompt") {
          return (
            <div className="fi fi-prompt" key={item.id}>
              <span className="fts">{fmtTs(item.ts)}</span>
              <span className="ftool t-prompt">you</span>
              <span className="farg"><em>{item.prompt}</em></span>
            </div>
          );
        }
        if (item.type === "turn") {
          return <div className="tmark" key={item.id}>TURN {item.turn}</div>;
        }
        if (item.type === "assistant") {
          return (
            <div className="fi fi-assistant" key={item.id}>
              <span className="fts">{fmtTs(item.ts)}</span>
              <span className="ftool t-claude">claude</span>
              <span className="farg"><em>{item.text}</em></span>
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
          <ReasoningLabel feedItems={feedItems} />
        </div>
      )}
      {resultText != null && (
        <div className="fi fi-result">
          <span className="ftool t-result">result</span>
          <span className="farg"><em>{resultText}</em></span>
        </div>
      )}
    </div>
  );
};

export default FeedList;
