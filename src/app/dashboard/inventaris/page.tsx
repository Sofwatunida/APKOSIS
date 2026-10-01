import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { DashboardShell } from "@/components/dashboard-shell";
import { InventarisClient } from "./inventaris-client";

export default async function InventarisPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <DashboardShell profile={scopedProfile}>
      <InventarisClient profile={scopedProfile} />
    </DashboardShell>
  );
}
