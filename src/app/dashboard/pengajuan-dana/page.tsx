import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { PengajuanDanaClient } from "./pengajuan-dana-client";

export default async function PengajuanDanaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  return (
    <DashboardShell profile={profile}>
      <PengajuanDanaClient profile={profile} />
    </DashboardShell>
  );
}
