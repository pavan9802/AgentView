import { memo } from "react";
import SessionHeader from "./feed/SessionHeader";
import FeedList from "./feed/FeedList";
import PromptBar from "./feed/PromptBar";

function FeedPanel() {
  return (
    <div className="main">
      <SessionHeader />
      <FeedList />
      <PromptBar />
    </div>
  );
}

export default memo(FeedPanel);
