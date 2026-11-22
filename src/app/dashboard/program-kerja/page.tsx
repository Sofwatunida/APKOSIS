import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { AppShell } from "@/components/app-shell";
import { ProgramKerjaClient } from "./program-kerja-client";
import { ProgramKerjaReadOnly } from "./program-kerja-readonly";

export default async function ProgramKerjaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin", "monitoring", "sekretaris"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <AppShell profile={scopedProfile}>
      {scopedProfile.role === "division_admin" ? (
        <ProgramKerjaClient profile={scopedProfile} />
      ) : (
        <ProgramKerjaReadOnly profile={scopedProfile} />
      )}
    </AppShell>
  );
}
