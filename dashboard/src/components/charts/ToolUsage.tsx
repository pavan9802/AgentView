import type { FeedItem } from "../../lib/types";

const TOOL_COLORS: Record<string, string> = {
  Read: "var(--blue)",
  Write: "var(--amber)",
  Bash: "var(--green)",
  Grep: "var(--purple)",
  Glob: "var(--purple)",
  WebSearch: "var(--blue)",
};

export default function ToolUsage({ feed }: { feed: FeedItem[] }) {
  const counts: Record<string, number> = {};
  feed.forEach((f) => {
    if (f.type === "tool") counts[f.tool] = (counts[f.tool] ?? 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;
  return (
    <div>
      <div className="chtitle">Tool usage</div>
      <div className="blist">
        {sorted.map(([tool, count]) => (
          <div className="brow" key={tool}>
            <span className="blbl" style={{ width: 66 }}>{tool}</span>
            <div className="bwrap">
              <div className="bfill2" style={{ width: `${(count / max) * 100}%`, background: TOOL_COLORS[tool] ?? "var(--text-dim)" }} />
            </div>
            <span className="bval">{count}x</span>
          </div>
        ))}
      </div>
    </div>
  );
}
