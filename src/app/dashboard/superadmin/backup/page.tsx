import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BackupClient } from "./backup-client";

export const dynamic = "force-dynamic";

export interface PeriodOption {
  id: string;
  namaPeriode: string;
  status: "active" | "archived" | "inactive";
}

export default async function SuperAdminBackupPage() {
  const { profile } = await requireProfile();
  requireSuperAdmin(profile);

  const supabase = await createClient();
  const { data } = await supabase
    .from("periods")
    .select("id, nama_periode, tahun_mulai, status")
    .order("tahun_mulai", { ascending: false });

  const periods: PeriodOption[] = (data ?? []).map((p) => ({
    id: p.id,
    namaPeriode: p.nama_periode ?? `${p.tahun_mulai ?? "-"}`,
    status: p.status as PeriodOption["status"],
  }));

  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <PageHeader
          title="Backup, Reset & Pemulihan"
          description="Unduh backup JSON, reset data operasional per periode, atau pulihkan dari file backup. Hanya Super Admin."
        />
        <BackupClient periods={periods} />
      </div>
    </AppShell>
  );
}
