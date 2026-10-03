import { requireProfile, requireAdminAccess } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getPeriodeContext } from "@/lib/period";
import { PasswordDivisiClient } from "./password-divisi-client";

export const dynamic = "force-dynamic";

export default async function AdminPasswordDivisiPage() {
  const { profile } = await requireProfile();
  requireAdminAccess(profile);

  const ctx = await getPeriodeContext(profile);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_division_credential_status", {
    p_periode_id: ctx.selected.id || null,
  });

  return (
    <AppShell profile={profile}>
      <PasswordDivisiClient
        periodeId={ctx.allPeriodsMode ? "" : ctx.selected.id}
        readOnly={ctx.readOnly}
        divisi={(data ?? []).map((row) => ({
          id: row.divisi_id,
          nomorDivisi: row.nomor_divisi,
          namaDivisi: row.nama_divisi,
          hasPassword: row.has_password,
          updatedAt: row.updated_at,
        }))}
      />

      <Card className="mt-6">
        <CardHeader title="Aturan Kredensial Divisi" />
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Ketua dan wakil divisi <strong>tidak dapat</strong> mengganti
              password sendiri.
            </li>
            <li>
              Password di-hash (bcrypt) di database dan tidak pernah
              ditampilkan kembali.
            </li>
            <li>
              Admin hanya boleh mengubah password divisi pada periode yang
              menjadi tanggung jawabnya.
            </li>
            <li>
              Password divisi periode sebelumnya tetap tersimpan di arsip dan
              tidak ikut berubah.
            </li>
          </ul>
          <p className="mt-4 text-sm">
            <a className="underline" href="/dashboard/admin/divisi">
              Kelola divisi periode ini
            </a>
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
