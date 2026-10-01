import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProgramKerjaClient } from "./program-kerja-client";
import { ProgramKerjaBendaharaClient } from "./program-kerja-bendahara-client";
import { ProgramKerjaReadOnly } from "./program-kerja-readonly";

export default async function ProgramKerjaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin", "monitoring", "sekretaris", "bendahara"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <DashboardShell profile={scopedProfile}>
      {scopedProfile.role === "division_admin" ? (
        <ProgramKerjaClient profile={scopedProfile} />
      ) : scopedProfile.role === "bendahara" ? (
        <ProgramKerjaBendaharaClient profile={scopedProfile} />
      ) : (
        <ProgramKerjaReadOnly profile={scopedProfile} />
      )}
    </DashboardShell>
  );
}
