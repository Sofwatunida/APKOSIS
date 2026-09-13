import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { RekapKendalaClient } from "@/app/dashboard/monitoring/rekap-kendala/rekap-kendala-client";

export default async function SekretarisRekapKendalaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <DashboardShell profile={profile}>
      <div className="space-y-6">
        <RekapKendalaClient profile={profile} />
      </div>
    </DashboardShell>
  );
}