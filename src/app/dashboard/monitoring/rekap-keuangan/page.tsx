import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { RekapKeuanganClient } from "./rekap-keuangan-client";

export default async function MonitoringRekapKeuanganPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <DashboardShell profile={profile}>
      <RekapKeuanganClient profile={profile} />
    </DashboardShell>
  );
}