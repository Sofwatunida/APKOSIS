import { requireProfile, requireRole } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { PasswordDivisiClient } from "./password-divisi-client";

export default async function PasswordDivisiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["division_admin"]);

  const supabase = await createClient();
  const { data } = await supabase.rpc("division_credential_status");

  return (
    <DashboardShell profile={profile}>
      <PasswordDivisiClient
        divisi={(data ?? []).map((row) => ({
          id: row.divisi_id,
          nomorDivisi: row.nomor_divisi,
          namaDivisi: row.nama_divisi,
          hasPassword: row.has_password,
          updatedAt: row.updated_at,
        }))}
      />
    </DashboardShell>
  );
}
