import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { LaporanHarianClient } from "./laporan-client";

export default async function LaporanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);

  return (
    <DashboardShell profile={profile}>
      <LaporanHarianClient profile={profile} />
    </DashboardShell>
  );
}
