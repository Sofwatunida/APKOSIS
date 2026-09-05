import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { BendaharaHome } from "./bendahara-home";

export default async function BendaharaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <DashboardShell profile={profile}>
      <BendaharaHome profile={profile} />
    </DashboardShell>
  );
}
