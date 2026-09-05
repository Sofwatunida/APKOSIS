import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { AnggotaClient } from "./anggota-client";

export default async function AnggotaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  return (
    <DashboardShell profile={profile}>
      <AnggotaClient profile={profile} />
    </DashboardShell>
  );
}
