import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { MonitoringRekapClient } from "./monitoring-rekap-client";

export default async function MonitoringRekapPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <DashboardShell profile={profile}>
      <MonitoringRekapClient profile={profile} />
    </DashboardShell>
  );
}
