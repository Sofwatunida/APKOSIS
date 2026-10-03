import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { RekapKendalaClient } from "./rekap-kendala-client";

export default async function MonitoringRekapKendalaPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <AppShell profile={profile}>
      <RekapKendalaClient profile={profile} />
    </AppShell>
  );
}