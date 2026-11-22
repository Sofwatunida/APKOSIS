import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { getPeriodeContext } from "@/lib/period";
import { ALL_PERIODS_VALUE } from "@/lib/period-constants";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Layers,
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

  return (
    <AppShell profile={profile}>
      {/* Satu pembungkus `space-y-6` supaya seluruh section punya jarak
          yang sama dan tidak saling menempel. */}
      <div className="space-y-6">
        <PageHeader title="Super Admin" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Periode"
            value={String(ctx.options.length)}
            icon={<CalendarRange className="h-5 w-5" />}
          />
          <StatCard
            label="Periode Aktif"
            value={
              ctx.options.find((p) => p.status === "active")?.namaPeriode ??
              "Belum ada"
            }
            tone="green"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Periode Arsip"
            value={String(archived)}
            tone="slate"
            icon={<Archive className="h-5 w-5" />}
          />
          <StatCard
            label="Mode Tampilan"
            value={ctx.allPeriodsMode ? "Semua Periode" : ctx.selected.namaPeriode}
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

        {ctx.allPeriodsMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Mode {ALL_PERIODS_VALUE} aktif: seluruh data periode ditampilkan
            sekaligus. Mode ini hanya bisa dibaca, operasi tulis tetap
            memerlukan satu periode aktif.
          </div>
        )}
      </div>
    </AppShell>
  );
}
