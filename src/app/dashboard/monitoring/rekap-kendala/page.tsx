import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { RekapKendalaClient } from "./rekap-kendala-client";

export default async function MonitoringRekapKendalaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <DashboardShell profile={profile}>
      <RekapKendalaClient profile={profile} />
    </DashboardShell>
  );
}