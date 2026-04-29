import { memo } from "react";
import { useAgentView } from "../store";
import { selectAllSessions } from "../store/selectors";

function Sidebar() {
  const sessions = useAgentView(selectAllSessions);
  const activeId = useAgentView((s) => s.activeId);
  const setActiveId = useAgentView((s) => s.setActiveId);
  const sendKill = useAgentView((s) => s.sendKill);

  return (
    <div className="sidebar">
      <div className="sb-hdr">Sessions — {sessions.length}</div>
      <div className="slist">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`sitem${s.id === activeId ? " active" : ""}`}
            onClick={() => setActiveId(s.id)}
          >
            <div className="sname">
              {s.prompt !== "" ? s.prompt : "Session in progress…"}
              {s.source === "claude_code" && <span className="pill pill-cc">CC</span>}
            </div>
            <div className="smeta">
              <span className={`badge badge-${s.status}`}>{s.status}</span>
              <span>${s.total_cost_usd.toFixed(3)}</span>
              {s.status === "running" && (
                <button
                  className="kill-btn"
                  title={s.source === "claude_code" ? "Stops at next tool call boundary" : "Kill session"}
                  onClick={(e) => { e.stopPropagation(); sendKill(s.id); }}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="smeta">
              <span>{s.total_turns} turns · {(s.total_tokens / 1000).toFixed(1)}k tok</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default memo(Sidebar);
