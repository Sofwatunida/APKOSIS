import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/card";
import { MonitoringDivisiClient } from "@/app/dashboard/monitoring/divisi/monitoring-divisi-client";

export default async function SekretarisDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <PageHeader
          title="Semua Divisi"
          description="Tampilan Sekretaris - seluruh divisi OSIS"
        />
        <MonitoringDivisiClient profile={profile} />
      </div>
    </AppShell>
  );
}
