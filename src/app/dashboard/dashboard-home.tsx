"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Divisi, LaporanHarian, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, todayISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/feedback";

export function DashboardHome({ profile }: { profile: Profile }) {
  const role = profile.role;

  if (role === "division_admin") return <DivisionDashboard profile={profile} />;
  if (role === "monitoring") return <MonitoringDashboard profile={profile} />;
  if (role === "sekretaris") return <StaffDashboard profile={profile} />;
  if (role === "bendahara") return <BendaharaDashboard profile={profile} />;
  return null;
}

function StatCard({
  label,
  value,
  sub,
  color = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "brand" | "green" | "red" | "amber" | "indigo";
}) {
  const colors: Record<string, string> = {
    brand: "text-brand-600",
    green: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
    indigo: "text-indigo-600",
  };
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${colors[color]}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ============ DIVISION ADMIN ============ */
function DivisionDashboard({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [divisi, setDivisi] = useState<Divisi | null>(null);
  const [anggotaCount, setAnggotaCount] = useState(0);
  const [laporanToday, setLaporanToday] = useState<LaporanHarian | null>(null);
  const [lastReport, setLastReport] = useState<LaporanHarian | null>(null);
  const [jumlahLaporan, setJumlahLaporan] = useState(0);
  const [pemasukan, setPemasukan] = useState(0);
  const [pengeluaran, setPengeluaran] = useState(0);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile.divisi_id) {
        setLoading(false);
        setNeedsSetup(true);
        return;
      }
      const { data: d } = await supabase
        .from("divisi")
        .select("*")
        .eq("id", profile.divisi_id)
        .single();
      setDivisi(d ?? null);

      if (d) {
        const missingSetup =
          !d.ketua_divisi && !d.wakil_divisi && anggotaCount === 0;
        const { data: anggota } = await supabase
          .from("anggota_divisi")
          .select("id", { count: "exact", head: true })
          .eq("divisi_id", d.id)
          .eq("status", "aktif");
        setAnggotaCount(anggota?.length ?? 0);

        const today = todayISO();
        const { data: lt } = await supabase
          .from("laporan_harian")
          .select("*")
          .eq("divisi_id", d.id)
          .eq("tanggal", today)
          .maybeSingle();
        setLaporanToday(lt ?? null);

        const { data: lr } = await supabase
          .from("laporan_harian")
          .select("*")
          .eq("divisi_id", d.id)
          .order("tanggal", { ascending: false })
          .limit(1)
          .maybeSingle();
        setLastReport(lr ?? null);

        const { count } = await supabase
          .from("laporan_harian")
          .select("id", { count: "exact", head: true })
          .eq("divisi_id", d.id);
        setJumlahLaporan(count ?? 0);

        const { data: tx } = await supabase
          .from("transaksi_keuangan")
          .select("nominal, jenis_transaksi")
          .eq("divisi_id", d.id);
        let masuk = 0;
        let keluar = 0;
        (tx ?? []).forEach((t) => {
          const n = Number(t.nominal) || 0;
          if (t.jenis_transaksi === "pemasukan") masuk += n;
          else keluar += n;
        });
        setPemasukan(masuk);
        setPengeluaran(keluar);

        setNeedsSetup(!missingSetup ? false : false);
        if (!d.ketua_divisi && !d.wakil_divisi && (anggota?.length ?? 0) === 0) {
          setNeedsSetup(true);
        }
      }
      setLoading(false);
    }
    load();
  }, [profile.divisi_id]);

  if (loading) return <Spinner />;

  if (needsSetup) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Lengkapi data divisi Anda terlebih dahulu
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Isi ketua, wakil, periode, anggota, dan program kerja agar dapat
            membuat laporan harian.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/profil-divisi"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Setup Profil Divisi
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {divisi?.nama_divisi ?? "Dashboard"}
        </h1>
        <p className="text-sm text-slate-500">
          {divisi?.periode} {divisi?.ketua_divisi && `• Ketua: ${divisi.ketua_divisi}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Anggota Aktif" value={String(anggotaCount)} color="indigo" />
        <StatCard
          label="Laporan Hari Ini"
          value={laporanToday ? "Sudah" : "Belum"}
          color={laporanToday ? "green" : "red"}
        />
        <StatCard label="Total Laporan" value={String(jumlahLaporan)} color="brand" />
        <StatCard
          label="Saldo"
          value={formatRupiah(pemasukan - pengeluaran)}
          color={pemasukan - pengeluaran >= 0 ? "green" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pemasukan" value={formatRupiah(pemasukan)} color="green" />
        <StatCard label="Pengeluaran" value={formatRupiah(pengeluaran)} color="red" />
        <Card>
          <CardContent className="flex h-full flex-col justify-center">
            {laporanToday ? (
              <Link
                href="/dashboard/laporan"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Edit Laporan Hari Ini
              </Link>
            ) : (
              <Link
                href="/dashboard/laporan"
                className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                + Isi Laporan Hari Ini
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {lastReport && (
        <Card>
          <CardHeader title="Laporan Terakhir" />
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  {formatDate(lastReport.tanggal)}
                </span>
                <Badge color="blue">Terakhir</Badge>
              </div>
              <p className="text-sm text-slate-600 line-clamp-3">
                {lastReport.kegiatan_hari_ini}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ============ MONITORING ============ */
function MonitoringDashboard({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [divisiList, setDivisiList] = useState<Divisi[]>([]);
  const [counts, setCounts] = useState<{ total: number; sudah: number; belum: number }>({
    total: 0,
    sudah: 0,
    belum: 0,
  });
  const [finance, setFinance] = useState({ pemasukan: 0, pengeluaran: 0 });

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase.from("divisi").select("*").order("nomor_divisi");
      const list = div ?? [];
      setDivisiList(list);

      const today = todayISO();
      let sudah = 0;
      let pembelian = 0;
      let pengeluaran = 0;

      const { data: reports } = await supabase
        .from("laporan_harian")
        .select("divisi_id, tanggal")
        .eq("tanggal", today);
      const reportedIds = new Set(reports?.map((r) => r.divisi_id) ?? []);
      sudah = reportedIds.size;

      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("nominal, jenis_transaksi");
      (txs ?? []).forEach((t) => {
        const n = Number(t.nominal) || 0;
        if (t.jenis_transaksi === "pemasukan") pembelian += n;
        else pengeluaran += n;
      });

      setCounts({ total: list.length, sudah, belum: list.length - sudah });
      setFinance({ pemasukan: pembelian, pengeluaran });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Monitoring</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Divisi" value={String(counts.total)} color="brand" />
        <StatCard label="Sudah Mengisi" value={String(counts.sudah)} color="green" />
        <StatCard label="Belum Mengisi" value={String(counts.belum)} color="red" />
        <StatCard
          label="Saldo Keseluruhan"
          value={formatRupiah(finance.pemasukan - finance.pengeluaran)}
          color="indigo"
        />
      </div>

      <Card>
        <CardHeader
          title="Status Laporan Hari Ini"
          action={
            <Link
              href="/dashboard/monitoring/divisi"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Lihat semua
            </Link>
          }
        />
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {divisiList.map((d) => {
              return (
                <Link
                  key={d.id}
                  href={`/dashboard/monitoring/divisi`}
                  className="rounded-lg border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{d.nama_divisi}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{d.ketua_divisi || "-"}</p>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ SEKERTARIS / STAFF ============ */
function StaffDashboard({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ divisi: 0, laporan: 0, anggota: 0 });
  const [finance, setFinance] = useState({ pemasukan: 0, pengeluaran: 0 });

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase.from("divisi").select("*");
      const { data: laporan } = await supabase.from("laporan_harian").select("*");
      const { data: anggota } = await supabase.from("anggota_divisi").select("*");
      const { data: txs } = await supabase.from("transaksi_keuangan").select("nominal, jenis_transaksi");

      let pemasukan = 0;
      let pengeluaran = 0;
      (txs ?? []).forEach((t) => {
        const n = Number(t.nominal) || 0;
        if (t.jenis_transaksi === "pemasukan") pemasukan += n;
        else pengeluaran += n;
      });

      setStats({
        divisi: div?.length ?? 0,
        laporan: laporan?.length ?? 0,
        anggota: anggota?.length ?? 0,
      });
      setFinance({ pemasukan, pengeluaran });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">
        Dashboard {profile.role === "sekretaris" ? "Sekretaris" : ""}
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Divisi" value={String(stats.divisi)} color="brand" />
        <StatCard label="Total Laporan" value={String(stats.laporan)} color="indigo" />
        <StatCard label="Total Anggota" value={String(stats.anggota)} color="amber" />
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Aksi Cepat</p>
            <Link
              href={profile.role === "sekretaris" ? "/dashboard/sekretaris/export" : "/dashboard/laporan"}
              className="mt-2 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Export Excel
            </Link>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total Pemasukan" value={formatRupiah(finance.pemasukan)} color="green" />
        <StatCard label="Total Pengeluaran" value={formatRupiah(finance.pengeluaran)} color="red" />
      </div>
    </div>
  );
}

/* ============ BENDAHARA ============ */
function BendaharaDashboard({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState({ pemasukan: 0, pengeluaran: 0 });
  const [recent, setRecent] = useState<TransaksiKeuangan[]>([]);

  useEffect(() => {
    async function load() {
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      let pemasukan = 0;
      let pengeluaran = 0;
      (txs ?? []).forEach((t) => {
        const n = Number(t.nominal) || 0;
        if (t.jenis_transaksi === "pemasukan") pemasukan += n;
        else pengeluaran += n;
      });

      setFinance({ pemasukan, pengeluaran });
      setRecent(txs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Bendahara</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Pemasukan" value={formatRupiah(finance.pemasukan)} color="green" />
        <StatCard label="Total Pengeluaran" value={formatRupiah(finance.pengeluaran)} color="red" />
        <StatCard
          label="Saldo"
          value={formatRupiah(finance.pemasukan - finance.pengeluaran)}
          color={finance.pemasukan - finance.pengeluaran >= 0 ? "brand" : "red"}
        />
      </div>

      <Card>
        <CardHeader title="Transaksi Terbaru" />
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Belum ada transaksi.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Keterangan</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50">
                      <td className="px-3 py-2">{formatDate(t.tanggal)}</td>
                      <td className="px-3 py-2">
                        <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                          {t.jenis_transaksi}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{t.keterangan}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatRupiah(t.nominal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
