import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { KebutuhanDivisiBendaharaClient } from "./kebutuhan-divisi-client";

export default async function BendaharaKebutuhanDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <DashboardShell profile={profile}>
      <KebutuhanDivisiBendaharaClient profile={profile} />
    </DashboardShell>
  );
}
