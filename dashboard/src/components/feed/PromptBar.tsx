import { memo, useState, useMemo } from "react";
import { useSessions } from "../../hooks/useSessions";
import { useAgentView } from "../../store";
import { selectSelectedSession, selectIsClaudeCodeSession } from "../../store/selectors";

function PromptBar() {
  const { startSession, addTurn, isStarting } = useSessions();
  const activeSession = useAgentView(selectSelectedSession);
  const injectionError = useAgentView((s) => s.injectionError);
  const setInjectionError = useAgentView((s) => s.setInjectionError);
  const [prompt, setPrompt] = useState("");
  const isCcSelector = useMemo(() => selectIsClaudeCodeSession(activeSession?.id ?? ""), [activeSession?.id]);
  const isCc = useAgentView(isCcSelector);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    if (activeSession) {
      void addTurn(activeSession.id, prompt.trim());
    } else {
      void startSession(prompt.trim());
    }
    setPrompt("");
  };

  const placeholder = activeSession
    ? "Inject instructions into this session…"
    : "New session prompt…";

  if (isCc) {
    return (
      <div className="pbar-wrap">
        <div className="pbar pbar-cc">
          <span className="pbar-cc-msg">Running in Claude Code — prompt from your terminal</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pbar-wrap">
      {injectionError && (
        <div className="pbar-error">
          <span className="pbar-error-msg">Injection failed: {injectionError}</span>
          <button className="pbar-error-dismiss" onClick={() => setInjectionError(null)}>✕</button>
        </div>
      )}
      <div className="pbar">
        <span className="ppfx">❯</span>
        <input
          className="pinput"
          placeholder={placeholder}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
        <button className="pbtn" onClick={handleSubmit} disabled={!prompt.trim() || isStarting}>
          {activeSession ? "INJECT" : "RUN"}
        </button>
      </div>
    </div>
  );
};

export default memo(PromptBar);
