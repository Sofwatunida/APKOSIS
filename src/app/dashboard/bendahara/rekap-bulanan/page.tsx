import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { RekapBulananClient } from "./rekap-bulanan-client";

export default async function RekapBulananPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <DashboardShell profile={profile}>
      <RekapBulananClient profile={profile} />
    </DashboardShell>
  );
}
