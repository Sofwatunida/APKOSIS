import { requireProfile, requireAdminAccess } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { createClient } from "@/lib/supabase/server";
import { getPeriodeContext } from "@/lib/period";
import { fetchFinanceSummary } from "@/lib/finance";
import { formatRupiah } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/role";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { profile } = await requireProfile();
  requireAdminAccess(profile);

  const ctx = await getPeriodeContext(profile);
  const supabase = await createClient();

  // Semua query di halaman ini otomatis terfilter `periode_id`
  // sesuai periode yang dipilih, jadi angka antarperiode tidak
  // pernah tercampur.
  const [finance, laporan, anggota, transaksi] = await Promise.all([
    fetchFinanceSummary(supabase),
    supabase
      .from("laporan_harian")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("anggota_divisi")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("transaksi_keuangan")
      .select("id", { count: "exact", head: true }),
  ]);

  const { data: divisi } = await supabase
    .from("divisi")
    .select("id, nomor_divisi, nama_divisi")
    .order("nomor_divisi");

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Admin Periode"
        description={`Mengelola operasional periode ${ctx.selected.namaPeriode}.`}
      />

      {!ctx.canWrite && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {ctx.readOnly
            ? `Periode ${ctx.selected.namaPeriode} sudah diarsipkan. Data hanya bisa dibaca, tidak bisa ditambah atau diubah.`
            : "Belum ada periode aktif. Hubungi Super Admin."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo Akhir"
          value={formatRupiah(finance.totalSaldo)}
          sub="Saldo awal + pemasukan - pengeluaran"
          tone="green"
        />
        <StatCard
          label="Laporan Masuk"
          value={String(laporan.count ?? 0)}
          sub="Laporan harian periode ini"
        />
        <StatCard
          label="Anggota Terdaftar"
          value={String(anggota.count ?? 0)}
          sub="Seluruh divisi"
          tone="indigo"
        />
        <StatCard
          label="Transaksi"
          value={String(transaksi.count ?? 0)}
          sub="Kas masuk dan keluar"
          tone="slate"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pengelolaan Divisi" />
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Admin menyiapkan akun dan kredensial divisi untuk periode yang
              sedang berjalan.
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a className="underline" href="/dashboard/admin/password-divisi">
                  Reset Password Divisi
                </a>{" "}
                — hanya Super Admin dan Admin yang boleh mengubahnya.
              </li>
              <li>
                <a className="underline" href="/dashboard/admin/divisi">
                  Hubungkan Divisi ke Periode
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Status Divisi" />
          <CardContent>
            {(divisi ?? []).length === 0 ? (
              <EmptyState title="Belum ada divisi" description="Data divisi belum tersedia." />
            ) : (
              <ul className="space-y-2 text-sm">
                {(divisi ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <span>
                      Divisi {d.nomor_divisi} — {d.nama_divisi}
                    </span>
                    <Badge color="slate">Terdaftar</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Batas Kekuasan Admin" />
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Admin hanya mengelola periode yang ditugaskan kepadanya.</li>
            <li>
              Admin tidak dapat mengubah role menjadi super_admin, mengubah
              akun Super Admin, atau memberikan role super_admin kepada siapa pun.
            </li>
            <li>
              Admin periode {(profile.periode_id ? "yang ditugaskan" : "berikutnya")}{" "}
              tidak otomatis berlaku untuk periode berikutnya.
            </li>
            <li>
              Role yang tersedia:{" "}
              {(Object.keys(ROLE_LABELS) as Role[])
                .filter((r) => r !== "super_admin")
                .map((r) => ROLE_LABELS[r])
                .join(", ")}
              .
            </li>
          </ul>
        </CardContent>
      </Card>
    </AppShell>
  );
}
