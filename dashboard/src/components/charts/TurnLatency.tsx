import type { LatencyPoint } from "../../lib/types";

export default function TurnLatency({ turns }: { turns: LatencyPoint[] }) {
  const max = Math.max(...turns.map((t) => t.latency), 1);
  return (
    <div>
      <div className="chtitle">Per-turn latency</div>
      <div className="blist">
        {turns.slice(-7).map((t, i) => (
          <div className="brow" key={i}>
            <span className="blbl" style={{ width: 22 }}>T{t.turn}</span>
            <div className="bwrap">
              <div className="bfill2" style={{ width: `${(t.latency / max) * 100}%`, background: t.latency > 3000 ? "var(--amber)" : "var(--green)" }} />
            </div>
            <span className="bval">{(t.latency / 1000).toFixed(1)}s</span>
            <span className="bval" style={{ color: "var(--text-muted)", fontSize: 9 }}>{(t.tokens / 1000).toFixed(1)}k</span>
          </div>
        ))}
      </div>
    </div>
  );
}
