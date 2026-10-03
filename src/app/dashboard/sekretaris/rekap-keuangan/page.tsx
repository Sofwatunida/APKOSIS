import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { RekapKeuanganClient } from "@/app/dashboard/monitoring/rekap-keuangan/rekap-keuangan-client";

export default async function SekretarisRekapKeuanganPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <RekapKeuanganClient profile={profile} />
      </div>
    </AppShell>
  );
}