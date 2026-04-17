import { memo } from "react";
import { BUDGET } from "../lib/constants";
import { useAgentView } from "../store";
import { selectRunningCount, selectTotalCost, selectBudgetPct } from "../store/selectors";

function Topbar() {
  const runningCount = useAgentView(selectRunningCount);
  const totalCost = useAgentView(selectTotalCost);
  const budgetPct = useAgentView(selectBudgetPct);
  const sessionCount = useAgentView((s) => Object.keys(s.sessions).length);
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

export default memo(Topbar);
