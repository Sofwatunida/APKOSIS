import { requireProfile, requireAdminAccess } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
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
      <div className="space-y-6">
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

        <p className="text-sm">
          <a className="underline" href="/dashboard/admin/divisi">
            Kelola divisi periode ini
          </a>
        </p>
      </div>
    </AppShell>
  );
}
