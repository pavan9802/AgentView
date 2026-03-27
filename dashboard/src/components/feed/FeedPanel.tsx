import type React from "react";
import type { Session } from "../../lib/types";
import SessionHeader from "./SessionHeader";
import FeedList from "./FeedList";
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
      <FeedList selectedSession={selectedSession} feedRef={feedRef} />
      <PromptBar onSubmit={onSubmit} />
    </div>
  );
}
