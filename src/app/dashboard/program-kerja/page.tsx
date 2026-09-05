import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProgramKerjaClient } from "./program-kerja-client";

export default async function ProgramKerjaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  return (
    <DashboardShell profile={profile}>
      <ProgramKerjaClient profile={profile} />
    </DashboardShell>
  );
}
