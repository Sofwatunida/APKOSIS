import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { KebutuhanClient } from "./kebutuhan-client";

export default async function KebutuhanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  return (
    <DashboardShell profile={profile}>
      <KebutuhanClient profile={profile} />
    </DashboardShell>
  );
}
