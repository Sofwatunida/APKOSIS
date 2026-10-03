import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { AppShell } from "@/components/app-shell";
import { InventarisClient } from "./inventaris-client";

export default async function InventarisPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <AppShell profile={scopedProfile}>
      <InventarisClient profile={scopedProfile} />
    </AppShell>
  );
}
