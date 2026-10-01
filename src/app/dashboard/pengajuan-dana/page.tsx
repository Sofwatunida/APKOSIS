import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { DashboardShell } from "@/components/dashboard-shell";
import { PengajuanDanaClient } from "./pengajuan-dana-client";

export default async function PengajuanDanaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <DashboardShell profile={scopedProfile}>
      <PengajuanDanaClient profile={scopedProfile} />
    </DashboardShell>
  );
}
