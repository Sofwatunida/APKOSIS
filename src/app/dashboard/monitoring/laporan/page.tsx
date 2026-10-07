import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { LaporanDivisiTable } from "@/components/laporan-divisi-table";

export default async function MonitoringLaporanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Laporan Semua Divisi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Rekap pengisian laporan harian setiap divisi</p>
        </div>
        <LaporanDivisiTable />
      </div>
    </AppShell>
  );
}
