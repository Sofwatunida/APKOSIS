import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { ExportAdminClient } from "./export-admin-client";

export default async function SekretarisExportPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return (
    <DashboardShell profile={profile}>
      <ExportAdminClient profile={profile} />
    </DashboardShell>
  );
}
