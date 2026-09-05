import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { MonitoringDivisiClient } from "./monitoring-divisi-client";

export default async function MonitoringDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <DashboardShell profile={profile}>
      <MonitoringDivisiClient profile={profile} />
    </DashboardShell>
  );
}
