import { memo } from "react";
import type React from "react";
import type { Session } from "../lib/types";
import SessionHeader from "./feed/SessionHeader";
import FeedList from "./feed/FeedList";
import PromptBar from "./feed/PromptBar";

interface FeedPanelProps {
  selectedSession: Session;
  ctxPct: number;
  feedRef: React.RefObject<HTMLDivElement>;
  onSubmit: (prompt: string) => void;
}

function FeedPanel({
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

export default memo(FeedPanel);
