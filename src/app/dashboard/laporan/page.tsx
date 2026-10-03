import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { AppShell } from "@/components/app-shell";
import { LaporanHarianClient } from "./laporan-client";

export default async function LaporanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);

  return (
    <AppShell profile={scopedProfile}>
      <LaporanHarianClient profile={scopedProfile} />
    </AppShell>
  );
}
