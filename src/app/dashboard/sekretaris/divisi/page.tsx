import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { MonitoringDivisiClient } from "@/app/dashboard/monitoring/divisi/monitoring-divisi-client";

export default async function SekretarisDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <DashboardShell profile={profile}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Semua Divisi</h1>
          <p className="text-sm text-slate-500">Tampilan Sekretaris - seluruh divisi OSIS</p>
        </div>
        <MonitoringDivisiClient profile={profile} />
      </div>
    </DashboardShell>
  );
}
