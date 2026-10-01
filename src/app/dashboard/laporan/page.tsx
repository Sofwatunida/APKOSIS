import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { DashboardShell } from "@/components/dashboard-shell";
import { LaporanHarianClient } from "./laporan-client";

export default async function LaporanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);

  return (
    <DashboardShell profile={scopedProfile}>
      <LaporanHarianClient profile={scopedProfile} />
    </DashboardShell>
  );
}
