import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const USED_COLOR = "#4da6ff";
const FREE_COLOR = "#2a2a2a";

export default function ContextPie({ ctxPct }: { ctxPct: number }) {
  const used = Math.min(Math.max(ctxPct, 0), 100);
  const free = 100 - used;
  const data = [{ value: used }, { value: free }];
  return (
    <div>
      <div className="chtitle">Context window</div>
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
            <Cell fill={USED_COLOR} />
            <Cell fill={FREE_COLOR} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="cleg">
        <div className="crow">
          <div className="cdl"><div className="cdot" style={{ background: USED_COLOR }} /><span style={{ color: "var(--text-dim)" }}>Used</span></div>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>{used.toFixed(1)}%</span>
        </div>
        <div className="crow">
          <div className="cdl"><div className="cdot" style={{ background: FREE_COLOR, border: "1px solid #444" }} /><span style={{ color: "var(--text-dim)" }}>Free</span></div>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>{free.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
