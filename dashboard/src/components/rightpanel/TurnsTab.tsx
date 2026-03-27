import TurnLatency from "../charts/TurnLatency";
import ToolUsage from "../charts/ToolUsage";
import type { Session } from "../../lib/types";

interface TurnsTabProps {
  selectedSession: Session;
}

export default function TurnsTab({ selectedSession }: TurnsTabProps) {
  return (
    <>
      <TurnLatency turns={selectedSession.turnLatency} />
      <div className="divider" />
      <ToolUsage feed={selectedSession.feed} />
    </>
  );
}
