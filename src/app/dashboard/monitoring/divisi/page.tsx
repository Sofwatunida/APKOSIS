import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { MonitoringDivisiClient } from "./monitoring-divisi-client";

export default async function MonitoringDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <AppShell profile={profile}>
      <MonitoringDivisiClient profile={profile} />
    </AppShell>
  );
}
