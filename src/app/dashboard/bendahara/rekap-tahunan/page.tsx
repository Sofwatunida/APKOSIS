import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { RekapTahunanClient } from "./rekap-tahunan-client";

export default async function RekapTahunanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <AppShell profile={profile}>
      <RekapTahunanClient profile={profile} />
    </AppShell>
  );
}
