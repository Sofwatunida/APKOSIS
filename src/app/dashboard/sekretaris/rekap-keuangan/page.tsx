import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { RekapKeuanganClient } from "@/app/dashboard/monitoring/rekap-keuangan/rekap-keuangan-client";

export default async function SekretarisRekapKeuanganPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <DashboardShell profile={profile}>
      <div className="space-y-6">
        <RekapKeuanganClient profile={profile} />
      </div>
    </DashboardShell>
  );
}