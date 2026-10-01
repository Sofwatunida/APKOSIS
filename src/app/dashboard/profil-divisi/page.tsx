import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfilDivisiClient } from "./profil-client";

export default async function ProfilDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <DashboardShell profile={scopedProfile}>
      <ProfilDivisiClient profile={scopedProfile} />
    </DashboardShell>
  );
}
