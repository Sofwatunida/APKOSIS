import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { InventarisClient } from "./inventaris-client";

export default async function InventarisPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  return (
    <DashboardShell profile={profile}>
      <InventarisClient profile={profile} />
    </DashboardShell>
  );
}
