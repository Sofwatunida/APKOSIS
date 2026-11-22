import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/card";
import { LaporanDivisiTable } from "@/components/laporan-divisi-table";

export default async function MonitoringLaporanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <PageHeader
          title="Laporan Semua Divisi"
        />
        <LaporanDivisiTable />
      </div>
    </AppShell>
  );
}
