const TOOL_COLORS: Record<string, string> = {
  Read: "var(--blue)",
  Write: "var(--amber)",
  Bash: "var(--green)",
  Grep: "var(--purple)",
  Glob: "var(--purple)",
  WebSearch: "var(--blue)",
};

export default function ToolUsage({ feed }: { feed: { tool: string; count: number }[] }) {
  const max = feed[0]?.count ?? 1;
  return (
    <div>
      <div className="chtitle">Tool usage</div>
      <div className="blist">
        {feed.map(({ tool, count }) => (
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
