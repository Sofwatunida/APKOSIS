import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { KeuanganClient } from "./keuangan-client";

export default async function KeuanganPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  return (
    <DashboardShell profile={profile}>
      <KeuanganClient profile={profile} />
    </DashboardShell>
  );
}
