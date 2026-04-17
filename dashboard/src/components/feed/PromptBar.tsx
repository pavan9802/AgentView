import { memo, useState } from "react";
import { useSessions } from "../../hooks/useSessions";

function PromptBar() {
  const { startSession, isStarting } = useSessions();
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    void startSession(prompt.trim());
    setPrompt("");
  };

  return (
    <div className="pbar">
      <span className="ppfx">❯</span>
      <input
        className="pinput"
        placeholder="New session or inject mid-task instructions…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
      />
      <button className="pbtn" onClick={handleSubmit} disabled={!prompt.trim() || isStarting}>
        RUN
      </button>
    </div>
  );
};

export default memo(PromptBar);
