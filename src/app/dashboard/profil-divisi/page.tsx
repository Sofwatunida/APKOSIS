import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { AppShell } from "@/components/app-shell";
import { ProfilDivisiClient } from "./profil-client";

export default async function ProfilDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <AppShell profile={scopedProfile}>
      <ProfilDivisiClient profile={scopedProfile} />
    </AppShell>
  );
}
