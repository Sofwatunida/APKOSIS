import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { PengajuanDanaBendaharaClient } from "./pengajuan-dana-bendahara-client";

export default async function BendaharaPengajuanDanaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <AppShell profile={profile}>
      <PengajuanDanaBendaharaClient profile={profile} />
    </AppShell>
  );
}
