import { useState, memo } from "react";

interface PromptBarProps {
  onSubmit: (prompt: string) => void;
}

const PromptBar = memo(function PromptBar({ onSubmit }: PromptBarProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onSubmit(prompt);
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
      <button className="pbtn" onClick={handleSubmit} disabled={!prompt.trim()}>
        RUN
      </button>
    </div>
  );
});

export default PromptBar;
