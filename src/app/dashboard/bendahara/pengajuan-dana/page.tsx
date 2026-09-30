import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { PengajuanDanaBendaharaClient } from "./pengajuan-dana-bendahara-client";

export default async function BendaharaPengajuanDanaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <DashboardShell profile={profile}>
      <PengajuanDanaBendaharaClient profile={profile} />
    </DashboardShell>
  );
}
