import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { DashboardShell } from "@/components/dashboard-shell";
import { KeuanganClient } from "./keuangan-client";

export default async function KeuanganPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <DashboardShell profile={scopedProfile}>
      <KeuanganClient profile={scopedProfile} />
    </DashboardShell>
  );
}
