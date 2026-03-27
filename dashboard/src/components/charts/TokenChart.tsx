import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import ChartTip from "./ChartTip";
import type { TokenPoint } from "../../lib/types";

export default function TokenChart({ data }: { data: TokenPoint[] }) {
  return (
    <div>
      <div className="chtitle">Token growth / turn</div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="turn" tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip content={<ChartTip />} />
          <Line type="monotone" dataKey="tokens" stroke="var(--green)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "var(--green)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
