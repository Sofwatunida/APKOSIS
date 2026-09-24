"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { Profile, Divisi, LaporanHarian, TransaksiKeuangan, KendalaSolusi } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, todayISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/feedback";
import { FinanceSummary } from "@/components/finance-summary";
import { ExportMenu } from "@/components/export-menu";
import {
  Users,
  ClipboardCheck,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Eye,
  AlertCircle,
  Check,
} from "lucide-react";

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
  icon: IconComponent,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "brand" | "green" | "red" | "amber" | "indigo";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const configs: Record<string, { text: string; bg: string; iconColor: string; ring: string }> = {
    brand: {
      text: "text-brand-600 dark:text-brand-400",
      bg: "bg-brand-50/80 dark:bg-brand-900/20",
      iconColor: "text-brand-600 dark:text-brand-400",
      ring: "ring-brand-500/10",
    },
    green: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50/80 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      ring: "ring-emerald-500/10",
    },
    red: {
      text: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50/80 dark:bg-rose-900/20",
      iconColor: "text-rose-600 dark:text-rose-400",
      ring: "ring-rose-500/10",
    },
    amber: {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50/80 dark:bg-amber-900/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      ring: "ring-amber-500/10",
    },
    indigo: {
      text: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50/80 dark:bg-indigo-900/20",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      ring: "ring-indigo-500/10",
    },
  };

  const current = configs[color] || configs.brand;

  return (
    <Card className="hover:shadow-elevated transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          {IconComponent && (
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${current.bg} ${current.iconColor} ring-1 ${current.ring}`}
            >
              <IconComponent className="h-4.5 w-4.5" />
            </div>
          )}
        </div>
        <p className={`mt-2 text-2xl font-bold tracking-tight ${current.text}`}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
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
  const [detailReport, setDetailReport] = useState<LaporanHarian | null>(null);
  const [detailKendala, setDetailKendala] = useState<KendalaSolusi[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Lengkapi data divisi Anda terlebih dahulu
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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

  async function handleOpenDetail(report: LaporanHarian) {
    setDetailReport(report);
    setLoadingDetail(true);
    const { data: ks } = await supabase
      .from("kendala_solusi")
      .select("*")
      .eq("laporan_id", report.id);
    setDetailKendala(ks ?? []);
    setLoadingDetail(false);
  }

  return (
    <div className="space-y-6">
      {/* 2026 Modern Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-elevated border border-slate-800/80">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 backdrop-blur-md mb-3 border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              <span>Divisi OSIS • Periode {divisi?.periode || "2025/2026"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {divisi?.nama_divisi ?? "Dashboard Divisi"}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              {divisi?.ketua_divisi ? `Ketua Divisi: ${divisi.ketua_divisi}` : "Ketua belum ditentukan"}
              {divisi?.wakil_divisi ? ` • Wakil: ${divisi.wakil_divisi}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/dashboard/laporan"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-brand-600" />
              <span>{laporanToday ? "Buka Laporan Hari Ini" : "Buat Laporan Hari Ini"}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Anggota Aktif"
          value={String(anggotaCount)}
          color="indigo"
          icon={Users}
          sub="Anggota terdaftar divisi"
        />
        <StatCard
          label="Laporan Hari Ini"
          value={laporanToday ? "Sudah Terisi" : "Belum Terisi"}
          color={laporanToday ? "green" : "red"}
          icon={ClipboardCheck}
          sub={laporanToday ? "Tercatat untuk hari ini" : "Perlu diisi sebelum akhir hari"}
        />
        <StatCard
          label="Total Laporan"
          value={String(jumlahLaporan)}
          color="brand"
          icon={FileText}
          sub="Akumulasi seluruh laporan"
        />
        <StatCard
          label="Saldo Divisi"
          value={formatRupiah(pemasukan - pengeluaran)}
          color={pemasukan - pengeluaran >= 0 ? "green" : "red"}
          icon={Wallet}
          sub="Pemasukan - Pengeluaran"
        />
      </div>

      {/* Financial Breakdown Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Pemasukan Kas Divisi"
          value={formatRupiah(pemasukan)}
          color="green"
          icon={TrendingUp}
        />
        <StatCard
          label="Total Pengeluaran Kas Divisi"
          value={formatRupiah(pengeluaran)}
          color="red"
          icon={TrendingDown}
        />
      </div>

      {/* Recent Report Card */}
      <Card>
        <CardHeader
          title="Laporan Terakhir Divisi"
          subtitle="Ringkasan pelaporan aktivitas harian terbaru"
          icon={<ClipboardCheck className="h-5 w-5" />}
          action={
            <Link
              href="/dashboard/laporan"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
            >
              <span>{laporanToday ? "Buka Halaman Laporan" : "+ Isi Laporan"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardContent className="p-6">
          {lastReport ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {formatDate(lastReport.tanggal)}
                  </span>
                  {lastReport.tanggal === todayISO() ? (
                    <Badge color="green">Hari Ini</Badge>
                  ) : (
                    <Badge color="blue">Terakhir</Badge>
                  )}
                  {lastReport.penerima_laporan && (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Penerima: {lastReport.penerima_laporan}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(lastReport)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs transition hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98]"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    <span>Detail</span>
                  </button>
                  <Link
                    href={`/dashboard/laporan?edit=${lastReport.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-900/20 px-3.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 shadow-xs transition hover:bg-blue-100 dark:hover:bg-blue-900/20 active:scale-[0.98]"
                  >
                    <span>Edit Laporan</span>
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Kegiatan Terlaksana
                </p>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {lastReport.kegiatan_hari_ini}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                <FileText className="h-6 w-6 stroke-[1.5]" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Belum ada laporan yang tercatat.</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mulai buat laporan untuk mendokumentasikan kegiatan harian divisi.</p>
              <Link
                href="/dashboard/laporan"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Mulai Buat Laporan Hari Ini</span>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(detailReport)}
        onClose={() => setDetailReport(null)}
        title={`Detail Laporan — ${detailReport ? formatDate(detailReport.tanggal) : ""}`}
      >
        {detailReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                <p className="text-xs text-slate-400">Tanggal Laporan</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(detailReport.tanggal)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                <p className="text-xs text-slate-400">Penerima Laporan</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{detailReport.penerima_laporan || "-"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kegiatan Hari Ini</p>
              <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {detailReport.kegiatan_hari_ini}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kendala dan Solusi</p>
              {loadingDetail ? (
                <div className="py-4 text-center text-xs text-slate-400">Memuat kendala...</div>
              ) : detailKendala.length > 0 ? (
                <div className="mt-1.5 space-y-2">
                  {detailKendala.map((k) => (
                    <div key={k.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 p-3 text-sm">
                      <p className="text-red-700 dark:text-red-400 font-medium">⚠️ Kendala: <span className="font-normal text-slate-800 dark:text-slate-200">{k.kendala}</span></p>
                      <p className="mt-1 text-emerald-700 dark:text-emerald-400 font-medium">💡 Solusi: <span className="font-normal text-slate-800 dark:text-slate-200">{k.solusi}</span></p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 p-3 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
                  Tidak ada kendala yang dilaporkan.
                </p>
              )}
            </div>

            {detailReport.informasi_lain && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Informasi Lain-lain</p>
                <p className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {detailReport.informasi_lain}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Link
                href={`/dashboard/laporan?edit=${detailReport.id}`}
                className="rounded-lg border border-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 shadow-sm"
              >
                Edit Laporan
              </Link>
              <button
                type="button"
                onClick={() => setDetailReport(null)}
                className="rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
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

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase.from("divisi").select("*").order("nomor_divisi");
      const list = div ?? [];
      setDivisiList(list);

      const today = todayISO();
      let sudah = 0;

      const { data: reports } = await supabase
        .from("laporan_harian")
        .select("divisi_id, tanggal")
        .eq("tanggal", today);
      const reportedIds = new Set(reports?.map((r) => r.divisi_id) ?? []);
      sudah = reportedIds.size;

      setCounts({ total: list.length, sudah, belum: list.length - sudah });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard Monitoring</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Pantau progres pelaporan harian seluruh divisi OSIS secara real-time</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Divisi Terdaftar"
          value={String(counts.total)}
          color="brand"
          icon={Layers}
          sub="Seluruh divisi di OSIS"
        />
        <StatCard
          label="Sudah Mengisi Laporan Hari Ini"
          value={String(counts.sudah)}
          color="green"
          icon={CheckCircle2}
          sub="Divisi aktif melapor"
        />
        <StatCard
          label="Belum Mengisi Hari Ini"
          value={String(counts.belum)}
          color="red"
          icon={Clock}
          sub="Perlu konfirmasi lanjutan"
        />
      </div>

      <FinanceSummary />

      <Card>
        <CardHeader
          title="Status Laporan Divisi Hari Ini"
          subtitle="Daftar divisi beserta pimpinan dan kelengkapan laporan"
          icon={<Layers className="h-5 w-5" />}
          action={
            <Link
              href="/dashboard/monitoring/divisi"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 shadow-xs transition hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:border-brand-300"
            >
              <span>Lihat Semua Divisi</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {divisiList.map((d) => {
              return (
                <Link
                  key={d.id}
                  href="/dashboard/monitoring/divisi"
                  className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs transition-all duration-150 hover:border-brand-400 hover:shadow-card hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                      {d.nama_divisi}
                    </span>
                    <span className="shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Div #{d.nomor_divisi}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    Ketua: <span className="text-slate-700 dark:text-slate-300 font-medium">{d.ketua_divisi || "Belum diset"}</span>
                  </p>
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

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase.from("divisi").select("*");
      const { data: laporan } = await supabase.from("laporan_harian").select("*");
      const { data: anggota } = await supabase.from("anggota_divisi").select("*");

      setStats({
        divisi: div?.length ?? 0,
        laporan: laporan?.length ?? 0,
        anggota: anggota?.length ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Dashboard {profile.role === "sekretaris" ? "Sekretaris OSIS" : "Staff"}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Pusat dokumentasi, administrasi surat menyurat, dan rekapitulasi divisi</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Divisi"
          value={String(stats.divisi)}
          color="brand"
          icon={Layers}
          sub="Divisi binaan OSIS"
        />
        <StatCard
          label="Total Laporan Terarsip"
          value={String(stats.laporan)}
          color="indigo"
          icon={FileText}
          sub="Akumulasi seluruh laporan harian"
        />
        <StatCard
          label="Total Anggota Terdata"
          value={String(stats.anggota)}
          color="amber"
          icon={Users}
          sub="Data keanggotaan seluruh divisi"
        />
      </div>

      <FinanceSummary />
    </div>
  );
}

/* ============ BENDAHARA ============ */
function extractBukti(raw: string): { cleanKeterangan: string; buktiUrl: string | null } {
  if (!raw) return { cleanKeterangan: "", buktiUrl: null };
  const match = raw.match(/\[BUKTI:([^\]]+)\]/);
  if (match) {
    return {
      cleanKeterangan: raw.replace(/\[BUKTI:[^\]]+\]/, "").trim(),
      buktiUrl: match[1],
    };
  }
  return { cleanKeterangan: raw, buktiUrl: null };
}

interface RecentRow extends TransaksiKeuangan {
  divisi?: { nama_divisi: string } | null;
}

function BendaharaDashboard({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [viewBuktiUrl, setViewBuktiUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("*, divisi(nama_divisi)")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      setRecent((txs ?? []) as RecentRow[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard Bendahara OSIS</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring kas induk, rekapitulasi pemasukan & pengeluaran divisi</p>
      </div>

      <FinanceSummary />

      <Card>
        <CardHeader
          title="Transaksi Keuangan Terbaru"
          subtitle="10 riwayat mutasi dana masuk & keluar terakhir"
          icon={<Wallet className="h-5 w-5" />}
          action={
            <ExportMenu
              title="Transaksi Keuangan Terbaru"
              filename="transaksi-keuangan-terbaru"
              disabled={recent.length === 0}
              columns={[
                { header: "Tanggal", key: "tanggal", width: 14 },
                { header: "Divisi", key: "divisi", width: 22 },
                { header: "Jenis", key: "jenis", width: 14 },
                { header: "Keterangan", key: "keterangan", width: 40 },
                { header: "Nominal", key: "nominal", width: 20, align: "right" },
              ]}
              rows={recent.map((t) => {
                const { cleanKeterangan } = extractBukti(t.keterangan);
                return {
                  tanggal: formatDate(t.tanggal),
                  divisi: t.divisi?.nama_divisi ?? "-",
                  jenis: t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran",
                  keterangan: cleanKeterangan,
                  nominal: formatRupiah(t.nominal),
                };
              })}
            />
          }
        />
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Belum ada transaksi tercatat.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-5 py-3.5 font-semibold">Tanggal</th>
                    <th className="px-5 py-3.5 font-semibold">Divisi</th>
                    <th className="px-5 py-3.5 font-semibold">Jenis</th>
                    <th className="px-5 py-3.5 font-semibold">Keterangan</th>
                    <th className="px-5 py-3.5 font-semibold">Bukti</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recent.map((t) => {
                    const { cleanKeterangan, buktiUrl } = extractBukti(t.keterangan);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-800 dark:text-slate-200">
                          {formatDate(t.tanggal)}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">{t.divisi?.nama_divisi ?? "-"}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                            {t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 max-w-xs truncate">{cleanKeterangan}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {buktiUrl ? (
                            <button
                              type="button"
                              onClick={() => setViewBuktiUrl(buktiUrl)}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-xs transition hover:bg-emerald-100 dark:hover:bg-emerald-900/20"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Lihat Bukti</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatRupiah(t.nominal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={Boolean(viewBuktiUrl)} onClose={() => setViewBuktiUrl(null)} title="Bukti Transaksi">
        {viewBuktiUrl && (
          <div className="space-y-4">
            <div className="max-h-[65vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 p-3 dark:bg-slate-900/60 flex items-center justify-center">
              <img
                src={viewBuktiUrl}
                alt="Bukti Transaksi"
                className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-card"
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewBuktiUrl(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
