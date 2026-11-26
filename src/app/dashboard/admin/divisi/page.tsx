import { requireProfile, requireAdminAccess } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getPeriodeContext } from "@/lib/period";
import { AdminDivisiClient } from "./admin-divisi-client";

export const dynamic = "force-dynamic";

export default async function AdminDivisiPage() {
  const { profile } = await requireProfile();
  requireAdminAccess(profile);

  const ctx = await getPeriodeContext(profile);
  const supabase = await createClient();
  const { data: divisi } = await supabase
    .from("divisi")
    .select("id, nomor_divisi, nama_divisi, periode_id")
    .order("nomor_divisi");

  // Pertahanan tambahan di server: Admin hanya melihat divisi
  // pada periode penugasannya (atau yang belum ditentukan).
  const allowedPeriodIds = new Set(ctx.options.map((p) => p.id));
  const rows = (divisi ?? []).filter(
    (d) =>
      profile.role === "super_admin" ||
      ctx.allPeriodsMode ||
      !d.periode_id ||
      allowedPeriodIds.has(d.periode_id)
  );

  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <PageHeader title="Kelola Divisi Periode" />

        <Card>
          <CardHeader title="Daftar Divisi" />
          <CardContent>
            <AdminDivisiClient
              divisi={rows.map((d) => ({
                id: d.id,
                nomorDivisi: d.nomor_divisi,
                namaDivisi: d.nama_divisi,
                periodeId: d.periode_id ?? "",
              }))}
              periods={ctx.options.map((p) => ({
                id: p.id,
                namaPeriode: p.namaPeriode,
                status: p.status,
              }))}
              canChange={ctx.canChangePeriod}
              readOnly={ctx.readOnly}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
