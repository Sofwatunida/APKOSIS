import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { LaporanListView } from "@/components/laporan-list-view";

export default async function MonitoringLaporanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <DashboardShell profile={profile}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan Semua Divisi</h1>
          <p className="text-sm text-slate-500">Mode hanya-baca monitoring</p>
        </div>
        <LaporanListView />
      </div>
    </DashboardShell>
  );
}
