import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { MonitoringDivisiClient } from "@/app/dashboard/monitoring/divisi/monitoring-divisi-client";

export default async function SekretarisDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <AppShell profile={profile}>
      <MonitoringDivisiClient profile={profile} />
    </AppShell>
  );
}
