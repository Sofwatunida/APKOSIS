import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { MonitoringRekapClient } from "@/app/dashboard/monitoring/rekap/monitoring-rekap-client";

export default async function SekretarisRekapPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <DashboardShell profile={profile}>
      <div className="space-y-6">
        <MonitoringRekapClient profile={profile} />
      </div>
    </DashboardShell>
  );
}
