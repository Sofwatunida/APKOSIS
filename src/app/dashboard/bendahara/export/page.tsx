import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { ExportKeuanganClient } from "./export-keuangan-client";

export default async function BendaharaExportPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <DashboardShell profile={profile}>
      <ExportKeuanganClient profile={profile} />
    </DashboardShell>
  );
}
