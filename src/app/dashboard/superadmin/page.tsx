import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { getPeriodeContext } from "@/lib/period";
import { ALL_PERIODS_VALUE } from "@/lib/period-constants";

function periodBadge(status: string) {
  if (status === "active") return <Badge color="green">Aktif</Badge>;
  if (status === "archived") return <Badge color="slate">Arsip</Badge>;
  return <Badge color="amber">Belum Aktif</Badge>;
}

export default async function SuperAdminDashboard() {
  const { profile } = await requireProfile();
  requireSuperAdmin(profile);

  const ctx = await getPeriodeContext(profile);

  const archived = ctx.options.filter((p) => p.status === "archived").length;
  const upcoming = ctx.options.filter((p) => p.status !== "active").length;

  return (
    <AppShell profile={profile}>
      <PageHeader
        title="Super Admin"
        description="Kendali penuh atas seluruh periode, akun, dan konfigurasi APKOSIS."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Periode" value={String(ctx.options.length)} sub="Seluruh periode tercatat" />
        <StatCard
          label="Periode Aktif"
          value={
            ctx.options.find((p) => p.status === "active")?.namaPeriode ?? "Belum ada"
          }
          sub="Periode yang sedang berjalan"
        />
        <StatCard label="Periode Arsip" value={String(archived)} sub="Data lama, tetap bisa dibaca" />
        <StatCard
          label="Mode Tampilan"
          value={ctx.allPeriodsMode ? "Semua Periode" : ctx.selected.namaPeriode}
          sub="Data yang sedang ditampilkan"
        />
      </div>

      {upcoming > 0 && (
        <Card>
          <CardHeader title="Ada periode yang belum aktif" />
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aktifkan periode baru dari halaman{" "}
              <a className="underline" href="/dashboard/superadmin/periode">
                Kelola Periode
              </a>{" "}
              ketika kepengurusan sebelumnya selesai.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title="Ringkasan Periode" />
        <CardContent>
          <div className="table-scroll">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Periode</th>
                  <th className="p-2 text-left">Tahun</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Tautan</th>
                </tr>
              </thead>
              <tbody>
                {ctx.options.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{p.namaPeriode}</td>
                    <td className="p-2">
                      {p.tahunMulai}/{p.tahunSelesai}
                    </td>
                    <td className="p-2">{periodBadge(p.status)}</td>
                    <td className="p-2">
                      <a
                        className="underline"
                        href={`/dashboard/superadmin/akun?periode=${p.id}`}
                      >
                        Kelola akun
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Pengaturan Sistem" />
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>
              <a className="underline" href="/dashboard/superadmin/periode">
                Kelola Periode
              </a>{" "}
              — buat, aktifkan, arsipkan, dan ubah periode.
            </li>
            <li>
              <a className="underline" href="/dashboard/superadmin/akun">
                Kelola Akun
              </a>{" "}
              — tetapkan Admin periode, ubah role, dan reset password divisi.
            </li>
            <li>
              <a className="underline" href="/dashboard/superadmin/divisi">
                Kelola Divisi
              </a>{" "}
              — hubungkan divisi ke periode yang sedang berjalan.
            </li>
          </ul>
          {ctx.allPeriodsMode && (
            <p className="mt-4 text-xs text-muted-foreground">
              Mode {ALL_PERIODS_VALUE} aktif: seluruh data periode ditampilkan
              sekaligus. Mode ini hanya bisa dibaca, operasi tulis tetap
              memerlukan satu periode aktif.
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
