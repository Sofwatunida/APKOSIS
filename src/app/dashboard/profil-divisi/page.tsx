import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfilDivisiClient } from "./profil-client";

export default async function ProfilDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  return (
    <DashboardShell profile={profile}>
      <ProfilDivisiClient profile={profile} />
    </DashboardShell>
  );
}
