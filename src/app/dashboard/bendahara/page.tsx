import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { BendaharaHome } from "./bendahara-home";

export default async function BendaharaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <AppShell profile={profile}>
      <BendaharaHome profile={profile} />
    </AppShell>
  );
}
