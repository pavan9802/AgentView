import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { PIE_COLORS, CTX_LABELS } from "../../lib/constants";

export default function ContextPie({ tokens }) {
  const sys = 8;
  const hist = Math.min(50 + Math.floor(tokens / 5000), 72);
  const tools = 18;
  const head = Math.max(100 - sys - hist - tools, 4);
  const data = [{value:sys},{value:hist},{value:tools},{value:head}];
  return (
    <div>
      <div className="chtitle">Context breakdown</div>
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
            {data.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="cleg">
        {data.map((d,i)=>(
          <div className="crow" key={i}>
            <div className="cdl"><div className="cdot" style={{background:PIE_COLORS[i]}}/><span style={{color:"var(--text-dim)"}}>{CTX_LABELS[i]}</span></div>
            <span style={{color:"var(--text)",fontWeight:600}}>{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
