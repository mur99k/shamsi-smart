import DashboardScreen from "@/components/dashboard/DashboardScreen";

export const metadata = {
  title: "Dashboard — SolarWise Decision Prototype",
  description: "Current simulated energy balance and advisory recommendation.",
};

export default function DashboardPage() {
  return <DashboardScreen />;
}
