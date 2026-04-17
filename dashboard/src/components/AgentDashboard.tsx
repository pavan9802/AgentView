import { styles } from "../styles/dashboardStyles";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import FeedPanel from "./FeedPanel";
import RightPanel from "./RightPanel";

export default function AgentDashboard() {
  return (
    <>
      <style>{styles}</style>
      <div className="dashboard">
        <Topbar />
        <Sidebar />
        <FeedPanel />
        <RightPanel />
      </div>
    </>
  );
}
