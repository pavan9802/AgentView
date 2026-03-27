import { BUDGET } from "../lib/constants";

interface TopbarProps {
  runningCount: number;
  totalCost: number;
  sessionCount: number;
  budgetPct: number;
}

function Topbar({ runningCount, totalCost, sessionCount, budgetPct }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="logo">AGENTVIEW</div>
      <div className="sep" />
      <div className="tbs">
        <div className={`pulse${runningCount > 1 ? " amber" : ""}`} />
        <b>{runningCount}</b> active
      </div>
      <div className="sep" />
      <div className="tbs">total cost <b>${totalCost.toFixed(4)}</b></div>
      <div className="sep" />
      <div className="tbs">sessions <b>{sessionCount}</b></div>
      <div className="tbr">
        <div className="tbs">budget ${BUDGET.toFixed(2)}</div>
        <div className="bwrap">
          <div className="bbar">
            <div
              className="bfill"
              style={{ width: `${budgetPct}%`, background: budgetPct > 75 ? "var(--amber)" : "var(--green)" }}
            />
          </div>
          <span style={{ fontSize: 10, color: budgetPct > 75 ? "var(--amber)" : "var(--text-dim)" }}>
            {budgetPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default Topbar;
