import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { RekapBulananClient } from "./rekap-bulanan-client";

export default async function RekapBulananPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <AppShell profile={profile}>
      <RekapBulananClient profile={profile} />
    </AppShell>
  );
}
