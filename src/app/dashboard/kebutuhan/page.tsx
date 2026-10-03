import { requireProfile, requireRole } from "@/lib/guard";
import {
  requireDivisionSelection,
  withActiveDivisi,
} from "@/lib/division-session";
import { AppShell } from "@/components/app-shell";
import { KebutuhanClient } from "./kebutuhan-client";

export default async function KebutuhanPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);
  await requireDivisionSelection();
  const scopedProfile = await withActiveDivisi(profile);
  return (
    <AppShell profile={scopedProfile}>
      <KebutuhanClient profile={scopedProfile} />
    </AppShell>
  );
}
