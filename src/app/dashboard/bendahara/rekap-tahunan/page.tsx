import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { RekapTahunanClient } from "./rekap-tahunan-client";

export default async function RekapTahunanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <DashboardShell profile={profile}>
      <RekapTahunanClient profile={profile} />
    </DashboardShell>
  );
}
