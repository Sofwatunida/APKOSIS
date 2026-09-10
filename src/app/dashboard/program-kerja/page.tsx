import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProgramKerjaClient } from "./program-kerja-client";
import { ProgramKerjaReadOnly } from "./program-kerja-readonly";

export default async function ProgramKerjaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin", "monitoring", "sekretaris", "bendahara"]);
  return (
    <DashboardShell profile={profile}>
      {profile.role === "division_admin" ? (
        <ProgramKerjaClient profile={profile} />
      ) : (
        <ProgramKerjaReadOnly profile={profile} />
      )}
    </DashboardShell>
  );
}
