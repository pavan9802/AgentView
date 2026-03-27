interface ChartTipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}

export default function ChartTip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ctip">
      <div className="tl">Turn {label}</div>
      <div className="tv">{payload[0]?.value.toLocaleString()} tokens</div>
    </div>
  );
}
