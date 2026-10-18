import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export interface PeriodOption {
  id: string;
  namaPeriode: string;
  status: "active" | "archived" | "inactive";
}

export interface DivisiOption {
  id: string;
  nomor: number;
  nama: string;
}

export default async function SuperAdminLaporanPage() {
  const { profile } = await requireProfile();
  requireSuperAdmin(profile);

  const supabase = await createClient();

  const [periodeRes, divisiRes] = await Promise.all([
    supabase
      .from("periods")
      .select("id, nama_periode, tahun_mulai, status")
      .order("tahun_mulai", { ascending: false }),
    supabase
      .from("divisi")
      .select("id, nomor_divisi, nama_divisi")
      .order("nomor_divisi"),
  ]);

  const periods: PeriodOption[] = (periodeRes.data ?? []).map((p) => ({
    id: p.id,
    namaPeriode: p.nama_periode ?? `${p.tahun_mulai ?? "-"}`,
    status: p.status as PeriodOption["status"],
  }));

  const divisi: DivisiOption[] = (divisiRes.data ?? []).map((d) => ({
    id: d.id,
    nomor: d.nomor_divisi,
    nama: d.nama_divisi,
  }));

  const defaultPeriode =
    periods.find((p) => p.status === "active")?.id ?? periods[0]?.id ?? "";

  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <PageHeader
          title="Cetak Laporan"
          description="Susun, pratinjau, dan cetak/ekspor laporan per periode, divisi, tanggal, dan jenis."
        />
        <ReportsClient
          periods={periods}
          divisi={divisi}
          defaultPeriodeId={defaultPeriode}
        />
      </div>
    </AppShell>
  );
}
