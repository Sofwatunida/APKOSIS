import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createPeriodeFormAction } from "../../actions/periode-actions";
import { PeriodeAdminClient } from "./periode-admin-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminPeriodePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; pesan?: string }>;
}) {
  const { profile } = await requireProfile();
  requireSuperAdmin(profile);

  const params = await searchParams;
  const feedback = params.pesan
    ? { ok: params.ok === "1", message: params.pesan }
    : null;

  const supabase = await createClient();
  const { data: periods } = await supabase.rpc("admin_period_list_all");

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Kelola Periode"
        description="Buat periode baru, tentukan periode aktif, dan arsipkan periode lama tanpa menghapus data."
      />

      {feedback && (
        <div
          className={
            feedback.ok
              ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : "rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
          }
        >
          {feedback.message}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Buat Periode Baru" />
          <CardContent>
            <form action={createPeriodeFormAction} className="space-y-4">
              <Field label="Nama Periode" hint="Format: 2027/2028">
                <Input name="nama_periode" placeholder="2027/2028" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tahun Mulai">
                  <Input
                    name="tahun_mulai"
                    type="number"
                    placeholder="2027"
                    required
                  />
                </Field>
                <Field label="Tahun Selesai">
                  <Input
                    name="tahun_selesai"
                    type="number"
                    placeholder="2028"
                    required
                  />
                </Field>
              </div>
              <Button type="submit" className="w-full">
                Buat Periode
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Daftar Periode" />
          <CardContent>
            <PeriodeAdminClient periods={periods ?? []} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
