import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { getPeriodeContext } from "@/lib/period";
import { ALL_PERIODS_VALUE } from "@/lib/period-constants";
import { createClient } from "@/lib/supabase/server";
import { PenyamaranClient } from "./penyamaran-client";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Layers,
  Settings2,
} from "lucide-react";

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

  // Daftar divisi untuk formulir Mode Penyamaran (Admin Divisi).
  const supabase = await createClient();
  const { data: divisiRows } = await supabase
    .from("divisi")
    .select("id, nomor_divisi, nama_divisi")
    .order("nomor_divisi", { ascending: true });
  const divisiOptions = (divisiRows ?? []).map((d) => ({
    id: d.id,
    label: `${d.nomor_divisi} — ${d.nama_divisi}`,
  }));

  return (
    <AppShell profile={profile}>
      {/* Satu pembungkus `space-y-6` supaya seluruh section punya jarak
          yang sama dan tidak saling menempel. */}
      <div className="space-y-6">
        <PageHeader
          title="Super Admin"
          description="Kendali penuh atas seluruh periode, akun, dan konfigurasi APKOSIS."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Periode"
            value={String(ctx.options.length)}
            sub="Seluruh periode tercatat"
            icon={<CalendarRange className="h-5 w-5" />}
          />
          <StatCard
            label="Periode Aktif"
            value={
              ctx.options.find((p) => p.status === "active")?.namaPeriode ??
              "Belum ada"
            }
            sub="Periode yang sedang berjalan"
            tone="green"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Periode Arsip"
            value={String(archived)}
            sub="Data lama, tetap bisa dibaca"
            tone="slate"
            icon={<Archive className="h-5 w-5" />}
          />
          <StatCard
            label="Mode Tampilan"
            value={ctx.allPeriodsMode ? "Semua Periode" : ctx.selected.namaPeriode}
            sub="Data yang sedang ditampilkan"
            tone="indigo"
            icon={<Layers className="h-5 w-5" />}
          />
        </div>

        {upcoming > 0 && (
          <Card>
            <CardHeader
              title="Ada periode yang belum aktif"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
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
          <CardHeader
            title="Ringkasan Periode"
            subtitle="Daftar seluruh periode beserta status dan tautan pengelolaan akunnya."
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <CardContent>
            <TableWrap minWidth={480}>
              <THead>
                <tr>
                  <TH>Periode</TH>
                  <TH>Tahun</TH>
                  <TH>Status</TH>
                  <TH>Tautan</TH>
                </tr>
              </THead>
              <TBody>
                {ctx.options.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-medium">{p.namaPeriode}</TD>
                    <TD>
                      {p.tahunMulai}/{p.tahunSelesai}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {periodBadge(p.status)}
                    </TD>
                    <TD>
                      <a
                        className="underline"
                        href={`/dashboard/superadmin/akun?periode=${p.id}`}
                      >
                        Kelola akun & divisi
                      </a>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </CardContent>
        </Card>

        {/* Mode Penyamaran — panel khusus Super Admin untuk melihat
            sistem dari sudut pandang role lain. */}
        <PenyamaranClient divisi={divisiOptions} />

        <Card>
          <CardHeader
            title="Pengaturan Sistem"
            icon={<Settings2 className="h-5 w-5" />}
          />
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
                  Pengelolaan Akun & Divisi
                </a>{" "}
                — tetapkan Admin periode, ubah role, kelola divisi, dan reset
                password divisi.
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
      </div>
    </AppShell>
  );
}
