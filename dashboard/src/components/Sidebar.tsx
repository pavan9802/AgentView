import type { Session } from "../lib/types";
import { memo } from "react";
interface SidebarProps {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
}

function Sidebar({ sessions, activeId, onSelect }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sb-hdr">Sessions — {sessions.length}</div>
      <div className="slist">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`sitem${s.id === activeId ? " active" : ""}${s.unread > 0 ? " unread" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="sname">{s.name}</div>
            <div className="smeta">
              <span className={`badge badge-${s.status}`}>{s.status}</span>
              <span>${s.cost.toFixed(3)}</span>
            </div>
            <div className="smeta">
              <span>{s.turn} turns · {(s.tokens / 1000).toFixed(1)}k tok</span>
              {s.unread > 0 && (
                <span style={{ color: "var(--green)", fontSize: 9 }}>{s.unread} new</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default memo(Sidebar);
