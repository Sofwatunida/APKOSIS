import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { RekapKeuanganClient } from "./rekap-keuangan-client";

export default async function MonitoringRekapKeuanganPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return (
    <AppShell profile={profile}>
      <RekapKeuanganClient profile={profile} />
    </AppShell>
  );
}