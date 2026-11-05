import DashboardScreen from "@/components/dashboard/DashboardScreen";
import LiveDashboard from "@/components/dashboard/LiveDashboard";

export const metadata = {
  title: "Dashboard — SolarWise Decision Prototype",
  description: "Current simulated energy balance and advisory recommendation.",
};

export default function DashboardPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>لوحة التحكم الحية</h1>
          <p>قراءات ESP32 لحظيًا، قرار النظام، التوزيع، والتحكم — بلا بيانات وهمية.</p>
        </div>
        <span className="badge">Live</span>
      </div>
      <LiveDashboard />
      <div className="sim-divider"><span>وضع المحاكاة · Simulation mode</span></div>
      <DashboardScreen />
    </>
  );
}
