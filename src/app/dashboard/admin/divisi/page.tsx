import { requireProfile, requireAdminAccess } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getPeriods } from "@/lib/period";
import { AdminDivisiClient } from "./admin-divisi-client";

export const dynamic = "force-dynamic";

export default async function AdminDivisiPage() {
  const { profile } = await requireProfile();
  requireAdminAccess(profile);

  const supabase = await createClient();
  const { data: divisi } = await supabase
    .from("divisi")
    .select("id, nomor_divisi, nama_divisi")
    .order("nomor_divisi");

  const periods = await getPeriods();

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Kelola Divisi Periode"
        description="Siapkan divisi untuk periode yang sedang Anda kelola."
      />

      <Card>
        <CardHeader title="Daftar Divisi" />
        <CardContent>
          <AdminDivisiClient
            divisi={(divisi ?? []).map((d) => ({
              id: d.id,
              nomorDivisi: d.nomor_divisi,
              namaDivisi: d.nama_divisi,
            }))}
            periods={periods.map((p) => ({
              id: p.id,
              namaPeriode: p.namaPeriode,
              status: p.status,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
