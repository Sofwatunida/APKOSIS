"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import {
  MONTH_NAMES_ID,
  endOfMonthISO,
  formatDate,
  startOfMonthISO,
} from "@/lib/date";
import { parseBukti } from "@/lib/bukti";
import {
  SEMUA_DIVISI_VALUE,
  SEMUA_DIVISI_LABEL,
  buildDivisiOptions,
  formatDivisiLabel,
  getDivisiFilterLabel,
  isSemuaDivisi,
} from "@/lib/divisi-options";
import { fetchSaldoAwal } from "@/lib/finance";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { BuktiButton, BuktiPreviewModal } from "@/components/ui/bukti";
import { ExportMenu } from "@/components/export-menu";
import {
  TrendingUp,
  TrendingDown,
  Coins,
  Wallet,
  Info,
} from "lucide-react";

type Periode = "bulanan" | "tahunan";

/** Baris transaksi + nama divisi asal (dipakai saat "Semua Divisi"). */
interface Row extends TransaksiKeuangan {
  divisi: { nomor_divisi: number | null; nama_divisi: string } | null;
}

function divisiLabel(divisi: Row["divisi"]): string {
  if (!divisi) return "-";
  return formatDivisiLabel(divisi.nomor_divisi, divisi.nama_divisi || "-");
}

/**
 * Halaman "Detail Keuangan" per divisi atau "Semua Divisi".
 *
 * Dibuka dari kartu/tabel rekap keuangan. Menampilkan rincian transaksi:
 * tanggal, jenis, sumber pemasukan / digunakan untuk, keterangan, bukti, nominal.
 * Pilihan "Semua Divisi" menampilkan seluruh transaksi seluruh divisi
 * (filter bulan/tahun tetap berlaku) lengkap dengan kolom divisi asal.
 * Kolom sumber & penggunaan dibuat nullable di database, jadi transaksi lama
 * yang belum punya rincian tetap tampil aman dengan tanda "-".
 */
export function DetailKeuanganClient({
  profile,
  initialDivisi,
  initialPeriode,
  embedded = false,
  onBack,
  initialMonth,
  initialYear,
  initialStartDate,
  initialEndDate,
  historyMode = false,
}: {
  profile: Profile;
  initialDivisi: string;
  initialPeriode: string;
  embedded?: boolean;
  onBack?: () => void;
  initialMonth?: number;
  initialYear?: number;
  initialStartDate?: string;
  initialEndDate?: string;
  /** Riwayat: seluruh transaksi divisi+periode aktif, tidak terikat filter ringkasan. */
  historyMode?: boolean;
}) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const initYear = initialYear ?? currentYear;
  const initMonth = initialMonth ?? currentMonth;
  const isHistory = embedded || historyMode;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [optReady, setOptReady] = useState(false);
  const [divisiId, setDivisiId] = useState(
    isSemuaDivisi(initialDivisi) ? SEMUA_DIVISI_VALUE : initialDivisi
  );
  const [namaDivisi, setNamaDivisi] = useState("");
  const [periode, setPeriode] = useState<Periode>(
    initialPeriode === "tahunan" ? "tahunan" : "bulanan"
  );
  const [filterMonth, setFilterMonth] = useState(initMonth);
  const [filterYear, setFilterYear] = useState(initYear);
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState(initialEndDate ?? "");
  const [filterJenis, setFilterJenis] = useState<"all" | "pemasukan" | "pengeluaran">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [viewBuktiUrl, setViewBuktiUrl] = useState<string | null>(null);

  /** "Semua Divisi" = tanpa filter divisi; seluruh data divisi ikut terhitung. */
  const semuaDivisi = isSemuaDivisi(divisiId);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("divisi")
        .select("id, nomor_divisi, nama_divisi")
        .order("nomor_divisi");
      const list = buildDivisiOptions(data);
      setDivisiOptions(list.map((d) => ({ id: d.id, nama: d.nama })));
      if (!initialDivisi && list.length > 0) setDivisiId(list[0].id);
      setOptReady(true);
    })();
  }, [initialDivisi]);

  useEffect(() => {
    if (embedded) {
      setDivisiId(isSemuaDivisi(initialDivisi) ? SEMUA_DIVISI_VALUE : initialDivisi);
      if (!historyMode) {
        if (initialMonth !== undefined) setFilterMonth(initialMonth);
        if (initialYear !== undefined) setFilterYear(initialYear);
        if (initialStartDate !== undefined) setStartDate(initialStartDate);
        if (initialEndDate !== undefined) setEndDate(initialEndDate);
        if (initialPeriode === "tahunan" || initialPeriode === "bulanan") setPeriode(initialPeriode);
      }
    }
  }, [embedded, historyMode, initialDivisi, initialMonth, initialYear, initialStartDate, initialEndDate, initialPeriode]);

  useEffect(() => {
    if (semuaDivisi) {
      setNamaDivisi(SEMUA_DIVISI_LABEL);
      return;
    }
    setNamaDivisi(divisiOptions.find((d) => d.id === divisiId)?.nama ?? "");
  }, [divisiId, divisiOptions, semuaDivisi]);

  useEffect(() => {
    if (!embedded && !historyMode) {
      if (periode === "bulanan") {
        setStartDate(startOfMonthISO(filterYear, filterMonth));
        setEndDate(endOfMonthISO(filterYear, filterMonth));
      } else {
        setStartDate(`${filterYear}-01-01`);
        setEndDate(`${filterYear}-12-31`);
      }
    }
  }, [embedded, historyMode, periode, filterMonth, filterYear]);

  useEffect(() => {
    async function load() {
      if (semuaDivisi && !optReady) {
        setLoading(false);
        return;
      }
      setLoading(true);

      let query = supabase
        .from("transaksi_keuangan")
        .select("*, divisi(nomor_divisi, nama_divisi)")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });

      if (!isHistory) {
        const from = startDate || (periode === "bulanan" ? startOfMonthISO(filterYear, filterMonth) : `${filterYear}-01-01`);
        const to = endDate || from;
        const [start, end] = from <= to ? [from, to] : [to, from];
        query = query.gte("tanggal", start).lte("tanggal", end);
      } else if (startDate || endDate) {
        const from = startDate || endDate!;
        const to = endDate || startDate!;
        const [start, end] = from <= to ? [from, to] : [to, from];
        query = query.gte("tanggal", start).lte("tanggal", end);
      }

      if (!semuaDivisi) query = query.eq("divisi_id", divisiId);

      const { data } = await query;
      setRows((data ?? []) as Row[]);
      setSaldoAwal(await fetchSaldoAwal(supabase, semuaDivisi ? null : divisiId));
      setLoading(false);
    }
    load();
  }, [divisiId, optReady, periode, filterMonth, filterYear, startDate, endDate, semuaDivisi, isHistory]);

  const total = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    rows.forEach((t) => {
      const n = Number(t.nominal) || 0;
      if (t.jenis_transaksi === "pemasukan") masuk += n;
      else keluar += n;
    });
    return { masuk, keluar, saldoAwal, saldo: saldoAwal + masuk - keluar };
  }, [rows, saldoAwal]);

  /**
   * Ringkasan per sumber: pemasukan, pengeluaran, dan netto-nya digabung.
   * Satu label bisa dipakai untuk pemasukan maupun pengeluaran (mis. "Lainnya"),
   * jadi dijumlahkan terpisah lalu dinilai netto = masuk − keluar.
   * Bar "Arus Kas" memakai total |arus| = masuk + keluar.
   */
  const perSumber = useMemo(() => {
    const map = new Map<string, { masuk: number; keluar: number }>();
    rows.forEach((t) => {
      const key =
        (t.jenis_transaksi === "pemasukan" ? t.sumber_pemasukan : t.digunakan_untuk) ??
        "(tidak diisi)";
      const cur = map.get(key) ?? { masuk: 0, keluar: 0 };
      const n = Number(t.nominal) || 0;
      if (t.jenis_transaksi === "pemasukan") cur.masuk += n;
      else cur.keluar += n;
      map.set(key, cur);
    });
    return [...map.entries()]
      .map(([label, v]) => ({
        label,
        masuk: v.masuk,
        keluar: v.keluar,
        netto: v.masuk - v.keluar,
        arus: v.masuk + v.keluar,
      }))
      .sort((a, b) => b.arus - a.arus);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((t) => {
      if (filterJenis !== "all" && t.jenis_transaksi !== filterJenis) return false;
      if (!q) return true;
      const { cleanKeterangan } = parseBukti(t.keterangan);
      const rincian = (t.jenis_transaksi === "pemasukan" ? t.sumber_pemasukan : t.digunakan_untuk) ?? "";
      const jenis = t.jenis_transaksi.toLowerCase();
      return (
        cleanKeterangan.toLowerCase().includes(q) ||
        rincian.toLowerCase().includes(q) ||
        String(t.nominal).includes(q) ||
        t.tanggal.includes(q) ||
        jenis.includes(q) ||
        (jenis === "pemasukan" ? "masuk" : "keluar").includes(q)
      );
    });
  }, [rows, filterJenis, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; rows: Row[] }>();
    filtered.forEach((r) => {
      const d = new Date(r.tanggal + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, { label, rows: [] });
      map.get(key)!.rows.push(r);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v);
  }, [filtered]);

  const labelPeriode = isHistory
    ? (startDate || endDate ? `${formatDate(startDate || endDate!)} - ${formatDate(endDate || startDate!)}` : "Seluruh riwayat periode aktif")
    : `${formatDate((startDate || (periode === "bulanan" ? startOfMonthISO(filterYear, filterMonth) : `${filterYear}-01-01`)))} - ${formatDate((endDate || startDate || (periode === "bulanan" ? endOfMonthISO(filterYear, filterMonth) : `${filterYear}-12-31`)))}`;

  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {embedded ? (
          onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Kembali ke Rekap Keuangan
            </button>
          ) : null
        ) : (
          <Link
            href={
              profile.role === "bendahara"
                ? "/dashboard/detail-keuangan"
                : profile.role === "sekretaris"
                  ? "/dashboard/sekretaris/rekap-keuangan"
                  : "/dashboard/monitoring/rekap-keuangan"
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Kembali ke Rekap Keuangan
          </Link>
        )}
        <PageHeader
          title={isHistory ? `Riwayat Transaksi ${namaDivisi || "Divisi"}` : `Detail Keuangan ${namaDivisi || "Divisi"}`}
          action={
            <ExportMenu
              title={`Detail Keuangan ${namaDivisi}`}
              subtitle={labelPeriode}
              filename={`detail-keuangan-${namaDivisi || "divisi"}-${filterYear}`}
              disabled={filtered.length === 0}
              division={getDivisiFilterLabel(divisiId, divisiOptions)}
              documentType="LAPORAN KEUANGAN"
              columns={[
                { header: "Tanggal", key: "tanggal", width: 13 },
                ...(semuaDivisi
                  ? [{ header: "Divisi", key: "divisi", width: 18 } as const]
                  : []),
                { header: "Jenis", key: "jenis", width: 13 },
                { header: "Sumber / Digunakan Untuk", key: "rincian", width: 22 },
                { header: "Keterangan", key: "keterangan", width: 32 },
                { header: "Nominal", key: "nominal", width: 20, align: "right" as const },
              ]}
              rows={filtered.map((t) => {
                const { cleanKeterangan } = parseBukti(t.keterangan);
                return {
                  tanggal: formatDate(t.tanggal),
                  divisi: divisiLabel(t.divisi),
                  jenis: t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran",
                  rincian: (t.jenis_transaksi === "pemasukan"
                    ? t.sumber_pemasukan
                    : t.digunakan_untuk) ?? "-",
                  keterangan: cleanKeterangan,
                  nominal: `${t.jenis_transaksi === "pemasukan" ? "+" : "-"} ${formatRupiah(t.nominal)}`,
                };
              })}
            />
          }
        />
      </div>

      {isHistory ? (
        <Card>
          <CardHeader title="Filter Riwayat" icon={<Wallet className="h-5 w-5" />} />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Dari Tanggal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Sampai Tanggal">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
              <Field label="Cari">
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Keterangan, tanggal, nominal, jenis..." />
              </Field>
              <div className="flex items-end">
                <button type="button" onClick={() => { setStartDate(""); setEndDate(""); setSearchQuery(""); setFilterJenis("all"); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Reset Filter
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !embedded && (
        <Card>
          <CardHeader title="Filter" icon={<Wallet className="h-5 w-5" />} />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Divisi">
                <Select value={divisiId} onChange={(e) => setDivisiId(e.target.value)}>
                  {divisiOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nama}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Periode">
                <Select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)}>
                  <option value="bulanan">Bulanan</option>
                  <option value="tahunan">Tahunan</option>
                </Select>
              </Field>
              {periode === "bulanan" && (
                <Field label="Bulan">
                  <Select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
                    {MONTH_NAMES_ID.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Tahun">
                <Select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Dari Tanggal">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Sampai Tanggal">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo Awal"
          value={formatRupiah(total.saldoAwal)}
          tone="indigo"
          icon={<Wallet className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Total Pemasukan"
          value={formatRupiah(total.masuk)}
          tone="green"
          icon={<TrendingUp className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Total Pengeluaran"
          value={formatRupiah(total.keluar)}
          tone="red"
          icon={<TrendingDown className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Saldo"
          value={formatRupiah(total.saldo)}
          tone={total.saldo >= 0 ? "brand" : "red"}
          icon={<Coins className="h-4.5 w-4.5" />}
        />
      </div>

      {perSumber.length > 0 && (
        <Card>
          <CardHeader
            title="Komposisi Nominal"
            subtitle="Pemasukan & pengeluaran digabung per sumber — netto = pemasukan − pengeluaran"
          />
          <CardContent>
            {/* overflow-x supaya kolom angka tidak saling menimpa di layar sempit */}
            <div className="overflow-x-auto">
              <div className="min-w-[720px] space-y-2">
                <div className="flex items-center gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span className="w-44 shrink-0">Sumber</span>
                  <span className="min-w-16 flex-1">Arus Kas</span>
                  <span className="w-32 shrink-0 text-right">Masuk</span>
                  <span className="w-32 shrink-0 text-right">Keluar</span>
                  <span className="w-32 shrink-0 text-right">Netto</span>
                </div>

                {perSumber.map((item) => {
                  const basis = total.masuk + total.keluar || 1;
                  const pct = Math.round((item.arus / basis) * 100);
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-1 py-2 dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <span
                        className="w-44 shrink-0 truncate text-xs font-medium text-slate-700 dark:text-slate-300"
                        title={item.label}
                      >
                        {item.label}
                      </span>
                      <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-32 shrink-0 text-right text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400">
                        {item.masuk > 0 ? `+${formatRupiah(item.masuk)}` : "-"}
                      </span>
                      <span className="w-32 shrink-0 text-right text-[11px] tabular-nums text-rose-600 dark:text-rose-400">
                        {item.keluar > 0 ? `-${formatRupiah(item.keluar)}` : "-"}
                      </span>
                      <span
                        className={`w-32 shrink-0 text-right text-[11px] font-bold tabular-nums ${
                          item.netto >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                        title={
                          item.netto >= 0
                            ? "Pemasukan lebih besar dari pengeluaran"
                            : "Pengeluaran lebih besar dari pemasukan"
                        }
                      >
                        {formatRupiah(item.netto)}
                      </span>
                    </div>
                  );
                })}

                <div className="flex items-center gap-3 border-t border-slate-200 px-1 pt-2 dark:border-slate-700">
                  <span className="w-44 shrink-0 text-xs font-bold text-slate-800 dark:text-slate-200">
                    Total
                  </span>
                  <span className="min-w-16 flex-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {perSumber.length} sumber · arus kas{" "}
                    {formatRupiah(total.masuk + total.keluar)}
                  </span>
                  <span className="w-32 shrink-0 text-right text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{formatRupiah(total.masuk)}
                  </span>
                  <span className="w-32 shrink-0 text-right text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    -{formatRupiah(total.keluar)}
                  </span>
                  <span
                    className={`w-32 shrink-0 text-right text-[11px] font-bold tabular-nums ${
                      total.saldo >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatRupiah(total.saldo)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Rincian Transaksi"
          icon={<Wallet className="h-5 w-5" />}
          action={
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              {(
                [
                  ["all", "Semua"],
                  ["pemasukan", "Pemasukan"],
                  ["pengeluaran", "Pengeluaran"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFilterJenis(val)}
                  className={`rounded-lg px-3 py-1 transition ${
                    filterJenis === val
                      ? "bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                      : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <CardContent className="p-0">
          {loading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                title="Belum ada transaksi"
                description={searchQuery ? "Coba ubah kata kunci pencarian/filter." : (semuaDivisi ? `Tidak ada transaksi divisi mana pun pada ${labelPeriode}.` : `Tidak ada transaksi ${namaDivisi || "divisi"} pada ${labelPeriode}.`)}
              />
            </div>
          ) : (
            <div className="space-y-0">
              {grouped.map((g) => (
                <div key={g.label}>
                  <div className="sticky top-0 z-[1] border-y border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                    {g.label}
                  </div>
                  <TableWrap minWidth={semuaDivisi ? 1120 : 980}>
                    <THead>
                      <tr>
                        <TH>Tanggal</TH>
                        {semuaDivisi && <TH>Divisi</TH>}
                        <TH>Jenis</TH>
                        <TH>Sumber / Digunakan Untuk</TH>
                        <TH>Keterangan</TH>
                        <TH>Bukti</TH>
                        <TH align="right">Nominal</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {g.rows.map((t) => {
                        const { cleanKeterangan, buktiRef } = parseBukti(t.keterangan);
                        const rincian = t.jenis_transaksi === "pemasukan" ? t.sumber_pemasukan : t.digunakan_untuk;
                        return (
                          <TR key={t.id}>
                            <TD className="whitespace-nowrap text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDate(t.tanggal)}</TD>
                            {semuaDivisi && <TD className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">{divisiLabel(t.divisi)}</TD>}
                            <TD className="whitespace-nowrap">
                              <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                                {t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
                              </Badge>
                            </TD>
                            <TD className="min-w-[10rem] text-xs text-slate-600 dark:text-slate-400">
                              {rincian ? <span className="font-medium text-slate-700 dark:text-slate-300">{rincian}</span> : <span className="text-slate-300 dark:text-slate-600">-</span>}
                            </TD>
                            <TD className="max-w-[18rem] text-xs text-slate-700 dark:text-slate-300"><span className="safe-text block">{cleanKeterangan || "-"}</span></TD>
                            <TD><BuktiButton buktiRef={buktiRef} onOpen={setViewBuktiUrl} /></TD>
                            <TD align="right" className="whitespace-nowrap font-bold">
                              <span className={t.jenis_transaksi === "pemasukan" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                                {t.jenis_transaksi === "pemasukan" ? "+ " : "- "}{formatRupiah(t.nominal)}
                              </span>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </TableWrap>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Kolom <strong>Sumber / Digunakan Untuk</strong> diisi pada form transaksi
          keuangan. Transaksi yang dibuat sebelum kolom ini tersedia akan
          menampilkan &quot;-&quot;.
        </p>
      </div>

      <BuktiPreviewModal
        buktiRef={viewBuktiUrl}
        onClose={() => setViewBuktiUrl(null)}
      />
    </div>
  );
}
