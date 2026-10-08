import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPeriods } from "@/lib/period";
import { DivisiPeriodeClient } from "./divisi-periode-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminDivisiPage() {
  const { profile } = await requireProfile();
  requireSuperAdmin(profile);

  const supabase = await createClient();
  const { data: divisi } = await supabase
    .from("divisi")
    .select("id, nomor_divisi, nama_divisi")
    .order("nomor_divisi");

  const periods = await getPeriods();
  const active = periods.find((p) => p.status === "active") ?? null;

  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <PageHeader
          title="Kelola Divisi"
          description="Hubungkan setiap divisi ke periode yang sedang berjalan."
        />

        <Card>
          <CardHeader
            title="Divisi"
            subtitle="Pilih periode yang menaungi setiap divisi. Perubahan langsung tersimpan."
            icon={<Users className="h-5 w-5" />}
          />
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Divisi bersifat tetap lintas periode; yang berubah adalah akun dan
              data yang tercatat di dalam periode tersebut.
              {active && ` Periode aktif saat ini: ${active.namaPeriode}.`}
            </p>
            <DivisiPeriodeClient
              periods={periods.map((p) => ({
                id: p.id,
                namaPeriode: p.namaPeriode,
                status: p.status,
              }))}
              divisi={(divisi ?? []).map((d) => ({
                id: d.id,
                nomorDivisi: d.nomor_divisi,
                namaDivisi: d.nama_divisi,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Status Periode"
            subtitle="Ringkasan status setiap periode yang terdaftar."
            icon={<BadgeCheck className="h-5 w-5" />}
          />
          <CardContent>
            <ul className="space-y-2 text-sm">
              {periods.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span>{p.namaPeriode}</span>
                  {p.status === "active" ? (
                    <Badge color="green">Aktif</Badge>
                  ) : p.status === "archived" ? (
                    <Badge color="slate">Arsip</Badge>
                  ) : (
                    <Badge color="amber">Belum Aktif</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
