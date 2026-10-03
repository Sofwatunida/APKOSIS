import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getPeriods } from "@/lib/period";
import { AccountsAdminClient } from "./accounts-admin-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminAkunPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { profile } = await requireProfile();
  requireSuperAdmin(profile);

  const supabase = await createClient();
  const params = await searchParams;

  // Tanpa parameter -> seluruh akun. Dengan parameter -> akun periode itu.
  const { data: accounts } = await supabase.rpc(
    "admin_accounts_list",
    params.periode ? { p_periode_id: params.periode } : { p_periode_id: null }
  );

  const { data: divisions } = await supabase.rpc("admin_division_account_list", {
    p_periode_id: params.periode ?? null,
  });

  const periods = await getPeriods();

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Kelola Akun"
        description="Tentukan Admin setiap periode, ubah role, dan reset kredensial divisi."
      />

      <AccountsAdminClient
        currentUserId={profile.id}
        selectedPeriodeId={params.periode ?? ""}
        periods={periods.map((p) => ({
          id: p.id,
          namaPeriode: p.namaPeriode,
          status: p.status,
        }))}
        accounts={(accounts ?? []).map((a) => ({
          id: a.id,
          nama: a.nama ?? "—",
          email: a.email ?? "—",
          role: a.role ?? "—",
          periodeId: a.periode_id ?? "",
          periodeNama: periods.find((p) => p.id === a.periode_id)?.namaPeriode ?? "—",
          assignedAt: a.assigned_at,
        }))}
        divisions={(divisions ?? []).map((d) => ({
          divisiId: d.divisi_id,
          nomorDivisi: d.nomor_divisi,
          namaDivisi: d.nama_divisi,
          accountCount: d.account_count,
          hasPassword: d.has_password,
          updatedAt: d.updated_at,
        }))}
      />

      <Card className="mt-6">
        <CardHeader title="Catatan Keamanan" />
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Hanya Super Admin yang dapat menetapkan Admin periode. Admin tidak
              dapat mengubah role menjadi super_admin.
            </li>
            <li>
              Admin periode 2026/2027 tidak otomatis menjadi Admin periode
              berikutnya; Super Admin harus menetapkannya kembali.
            </li>
            <li>
              Password divisi tidak pernah ditampilkan, hanya dapat direset.
            </li>
            <li>
              Akun Anda sendiri tidak dapat diubah role-nya dari halaman ini.
            </li>
          </ul>
        </CardContent>
      </Card>
    </AppShell>
  );
}
