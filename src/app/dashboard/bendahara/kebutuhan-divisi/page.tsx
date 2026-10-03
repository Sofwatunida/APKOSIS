import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { KebutuhanDivisiBendaharaClient } from "./kebutuhan-divisi-client";

export default async function BendaharaKebutuhanDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <AppShell profile={profile}>
      <KebutuhanDivisiBendaharaClient profile={profile} />
    </AppShell>
  );
}
