"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart2, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { ExportMenu } from "@/components/export-menu";
import type { ExportColumn } from "@/lib/export-client";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import type { DivisiOption, PeriodOption } from "./page";

type JenisKey =
  | "harian"
  | "keuangan"
  | "kendala"
  | "inventaris"
  | "program"
  | "rekap";

const JENIS: { key: JenisKey; label: string }[] = [
  { key: "harian", label: "Laporan Harian" },
  { key: "keuangan", label: "Keuangan" },
  { key: "kendala", label: "Kendala & Solusi" },
  { key: "inventaris", label: "Inventaris" },
  { key: "program", label: "Program Kerja" },
  { key: "rekap", label: "Rekap Seluruh Divisi" },
];

const MAX_ROWS = 3000;

function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function tgl(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface ReportResult {
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

export function ReportsClient({
  periods,
  divisi,
  defaultPeriodeId,
}: {
  periods: PeriodOption[];
  divisi: DivisiOption[];
  defaultPeriodeId: string;
}) {
  const [jenis, setJenis] = useState<JenisKey>("harian");
  const [periodeId, setPeriodeId] = useState(defaultPeriodeId);
  const [divisiId, setDivisiId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const divisiName = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of divisi) m.set(d.id, `${d.nomor} · ${d.nama}`);
    return m;
  }, [divisi]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");

    buildReport({ jenis, periodeId, divisiId, dateFrom, dateTo, divisiName })
      .then((r) => {
        if (ignore) return;
        setResult(r);
        setLoading(false);
      })
      .catch((e) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message : "Gagal memuat laporan.");
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [jenis, periodeId, divisiId, dateFrom, dateTo, divisiName]);

  const judul = useMemo(
    () => `Laporan ${JENIS.find((j) => j.key === jenis)?.label}`,
    [jenis]
  );

  const subtitle = useMemo(() => {
    const p =
      periods.find((x) => x.id === periodeId)?.namaPeriode ?? "Semua Periode";
    const d = divisiId ? (divisiName.get(divisiId) ?? "Semua Divisi") : "Seluruh Divisi";
    const rentang =
      dateFrom || dateTo
        ? `Tanggal: ${dateFrom ? tgl(dateFrom) : "..."} – ${dateTo ? tgl(dateTo) : "..."}`
        : null;
    return [p, d, rentang].filter(Boolean).join(" · ");
  }, [periodeId, divisiId, dateFrom, dateTo, periods, divisiName]);

  function handlePrint() {
    document.body.classList.add("print-report");
    const cleanup = () => {
      document.body.classList.remove("print-report");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  const kosong = !result || result.rows.length === 0;

  return (
    <div className="space-y-5">
      {/* Filter */}
      <Card className="no-print">
        <CardHeader
          title="Filter Laporan"
          subtitle="Pilih jenis, periode, divisi, dan rentang tanggal. Data diambil langsung dari basis data."
          icon={<FileBarChart2 className="h-5 w-5" />}
        />
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Jenis laporan">
              <Select value={jenis} onChange={(e) => setJenis(e.target.value as JenisKey)}>
                {JENIS.map((j) => (
                  <option key={j.key} value={j.key}>
                    {j.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Periode">
              <Select value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
                <option value="">Semua periode</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPeriode}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Divisi">
              <Select value={divisiId} onChange={(e) => setDivisiId(e.target.value)}>
                <option value="">Seluruh divisi</option>
                {divisi.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nomor} · {d.nama}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dari tanggal">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </Field>
            <Field label="Sampai tanggal">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Aksi ekspor + cetak */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {loading
            ? "Memuat laporan..."
            : result
              ? `Menampilkan ${result.rows.length} baris`
              : "Tidak ada data"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={loading || kosong}
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            <span>Cetak</span>
          </Button>
          <ExportMenu
            size="md"
            title={judul}
            subtitle={subtitle}
            filename={judul}
            disabled={loading || kosong}
            columns={result?.columns ?? []}
            rows={result?.rows ?? []}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-300"
        >
          Gagal memuat laporan: {error}
        </div>
      )}

      {/* Pratinjau */}
      <div id="report-print">
        <Card>
          <CardHeader
            title={judul}
            subtitle={subtitle}
            icon={<FileBarChart2 className="h-5 w-5" />}
          />
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memuat data laporan...</span>
              </div>
            ) : kosong ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada data untuk filter ini.
              </p>
            ) : (
              <TableWrap minWidth={Math.min(1200, 200 + (result?.columns.length ?? 1) * 150)}>
                <THead>
                  <TR>
                    {result?.columns.map((c) => (
                      <TH key={c.key} className={c.align === "right" ? "text-right" : ""}>
                        {c.header}
                      </TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {result?.rows.map((row, i) => (
                    <TR key={i}>
                      {result.columns.map((c) => (
                        <TD
                          key={c.key}
                          className={
                            (c.align === "right" ? "text-right tabular-nums " : "") +
                            "whitespace-nowrap text-sm"
                          }
                        >
                          {row[c.key] == null ? "" : String(row[c.key])}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface BuildArgs {
  jenis: JenisKey;
  periodeId: string;
  divisiId: string;
  dateFrom: string;
  dateTo: string;
  divisiName: Map<string, string>;
}

async function buildReport(args: BuildArgs): Promise<ReportResult> {
  const supabase = createClient();
  const { jenis, periodeId, divisiId, dateFrom, dateTo, divisiName } = args;
  const name = (id: string) => divisiName.get(id) ?? id.slice(0, 8);

  if (jenis === "harian") {
    let q = supabase
      .from("laporan_harian")
      .select("tanggal, divisi_id, kegiatan_hari_ini, informasi_lain, penerima_laporan")
      .order("tanggal", { ascending: true })
      .limit(MAX_ROWS);
    if (periodeId) q = q.eq("periode_id", periodeId);
    if (divisiId) q = q.eq("divisi_id", divisiId);
    if (dateFrom) q = q.gte("tanggal", dateFrom);
    if (dateTo) q = q.lte("tanggal", dateTo);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return {
      columns: [
        { header: "Tanggal", key: "tanggal", width: 1.1 },
        { header: "Divisi", key: "divisi", width: 1.3 },
        { header: "Kegiatan Hari Ini", key: "kegiatan", width: 2.4 },
        { header: "Informasi Lain", key: "informasi", width: 1.6 },
        { header: "Penerima", key: "penerima", width: 1.2 },
      ],
      rows: (data ?? []).map((r) => ({
        tanggal: tgl(r.tanggal),
        divisi: name(r.divisi_id),
        kegiatan: r.kegiatan_hari_ini,
        informasi: r.informasi_lain ?? "-",
        penerima: r.penerima_laporan ?? "-",
      })),
    };
  }

  if (jenis === "keuangan") {
    let q = supabase
      .from("transaksi_keuangan")
      .select(
        "tanggal, divisi_id, jenis_transaksi, sumber_pemasukan, digunakan_untuk, keterangan, nominal"
      )
      .order("tanggal", { ascending: true })
      .limit(MAX_ROWS);
    if (periodeId) q = q.eq("periode_id", periodeId);
    if (divisiId) q = q.eq("divisi_id", divisiId);
    if (dateFrom) q = q.gte("tanggal", dateFrom);
    if (dateTo) q = q.lte("tanggal", dateTo);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    type Trx = {
      tanggal: string;
      divisi_id: string;
      jenis_transaksi: string;
      sumber_pemasukan: string | null;
      digunakan_untuk: string | null;
      keterangan: string;
      nominal: number;
    };
    const list = (data ?? []) as Trx[];
    const clean = list.map((r) => ({
      tanggal: tgl(r.tanggal),
      divisi: name(r.divisi_id),
      jenis: r.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran",
      untuk:
        (r.jenis_transaksi === "pemasukan" ? r.sumber_pemasukan : r.digunakan_untuk) ?? "-",
      keterangan: r.keterangan,
      nominal: rupiah(r.nominal),
    }));
    const totalMasuk = list
      .filter((r) => r.jenis_transaksi === "pemasukan")
      .reduce((s, r) => s + r.nominal, 0);
    const totalKeluar = list
      .filter((r) => r.jenis_transaksi === "pengeluaran")
      .reduce((s, r) => s + r.nominal, 0);
    const summary: Record<string, unknown>[] = [
      { tanggal: "", divisi: "", jenis: "TOTAL", untuk: "", keterangan: "Total Pemasukan", nominal: rupiah(totalMasuk) },
      { tanggal: "", divisi: "", jenis: "", untuk: "", keterangan: "Total Pengeluaran", nominal: rupiah(totalKeluar) },
      { tanggal: "", divisi: "", jenis: "", untuk: "", keterangan: "Saldo", nominal: rupiah(totalMasuk - totalKeluar) },
    ];
    return {
      columns: [
        { header: "Tanggal", key: "tanggal", width: 1.1 },
        { header: "Divisi", key: "divisi", width: 1.2 },
        { header: "Jenis", key: "jenis", width: 1 },
        { header: "Sumber / Untuk", key: "untuk", width: 1.4 },
        { header: "Keterangan", key: "keterangan", width: 1.8 },
        { header: "Nominal", key: "nominal", width: 1.2, align: "right" },
      ],
      rows: [...clean, ...summary],
    };
  }

  if (jenis === "kendala") {
    let q = supabase
      .from("kendala_solusi")
      .select("kendala, solusi, created_at, laporan_harian(divisi_id, tanggal)")
      .limit(MAX_ROWS);
    if (periodeId) q = q.eq("periode_id", periodeId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    type KendalaRow = {
      kendala: string;
      solusi: string;
      created_at: string;
      laporan_harian: { divisi_id?: string; tanggal?: string } | null;
    };
    const list = (data ?? []) as unknown as KendalaRow[];
    return {
      columns: [
        { header: "Tanggal", key: "tanggal", width: 1.1 },
        { header: "Divisi", key: "divisi", width: 1.3 },
        { header: "Kendala", key: "kendala", width: 2.2 },
        { header: "Solusi", key: "solusi", width: 2.2 },
      ],
      rows: list.map((r) => ({
        tanggal: r.laporan_harian?.tanggal ? tgl(r.laporan_harian.tanggal) : tgl(r.created_at),
        divisi: r.laporan_harian?.divisi_id ? name(r.laporan_harian.divisi_id) : "-",
        kendala: r.kendala,
        solusi: r.solusi,
      })),
    };
  }

  if (jenis === "inventaris") {
    let q = supabase
      .from("inventaris")
      .select("divisi_id, nama_barang, jumlah, kondisi, keterangan")
      .order("nama_barang")
      .limit(MAX_ROWS);
    if (periodeId) q = q.eq("periode_id", periodeId);
    if (divisiId) q = q.eq("divisi_id", divisiId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return {
      columns: [
        { header: "Divisi", key: "divisi", width: 1.3 },
        { header: "Nama Barang", key: "barang", width: 2 },
        { header: "Jumlah", key: "jumlah", width: 0.8, align: "right" },
        { header: "Kondisi", key: "kondisi", width: 1.1 },
        { header: "Keterangan", key: "keterangan", width: 1.8 },
      ],
      rows: (data ?? []).map((r) => ({
        divisi: name(r.divisi_id),
        barang: r.nama_barang,
        jumlah: r.jumlah ?? 0,
        kondisi: r.kondisi ?? "-",
        keterangan: r.keterangan ?? "-",
      })),
    };
  }

  if (jenis === "program") {
    let q = supabase
      .from("program_kerja")
      .select("divisi_id, nama_program, deskripsi, file_name")
      .limit(MAX_ROWS);
    if (periodeId) q = q.eq("periode_id", periodeId);
    if (divisiId) q = q.eq("divisi_id", divisiId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return {
      columns: [
        { header: "Divisi", key: "divisi", width: 1.3 },
        { header: "Nama Program", key: "program", width: 2.2 },
        { header: "Deskripsi", key: "deskripsi", width: 2.4 },
        { header: "Berkas", key: "file", width: 1.4 },
      ],
      rows: (data ?? []).map((r) => ({
        divisi: name(r.divisi_id),
        program: r.nama_program ?? "-",
        deskripsi: r.deskripsi ?? "-",
        file: r.file_name ?? "-",
      })),
    };
  }

  // jenis === "rekap" — agregat seluruh divisi untuk satu periode.
  const filterPeriode = periodeId;

  async function collect<T>(
    table: "laporan_harian" | "transaksi_keuangan" | "inventaris" | "program_kerja",
    columns: string
  ): Promise<T[]> {
    let q = supabase.from(table).select(columns).limit(20000);
    if (filterPeriode) q = q.eq("periode_id", filterPeriode);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  }

  const [lap, trx, inv, pro] = await Promise.all([
    collect<{ divisi_id: string }>("laporan_harian", "divisi_id"),
    collect<{ divisi_id: string; jenis_transaksi: string; nominal: number }>(
      "transaksi_keuangan",
      "divisi_id, jenis_transaksi, nominal"
    ),
    collect<{ divisi_id: string }>("inventaris", "divisi_id"),
    collect<{ divisi_id: string }>("program_kerja", "divisi_id"),
  ]);

  let qK = supabase
    .from("kendala_solusi")
    .select("laporan_harian(divisi_id)")
    .limit(20000);
  if (filterPeriode) qK = qK.eq("periode_id", filterPeriode);
  const kendalaRes = await qK;
  if (kendalaRes.error) throw new Error(kendalaRes.error.message);
  const kendalaRows = (kendalaRes.data ?? []) as unknown as {
    laporan_harian: { divisi_id: string } | null;
  }[];

  const byDivisi = new Map<
    string,
    { laporan: number; kendala: number; pemasukan: number; pengeluaran: number; inventaris: number; program: number }
  >();
  const ensure = (id: string) => {
    let row = byDivisi.get(id);
    if (!row) {
      row = { laporan: 0, kendala: 0, pemasukan: 0, pengeluaran: 0, inventaris: 0, program: 0 };
      byDivisi.set(id, row);
    }
    return row;
  };

  for (const r of lap) ensure(r.divisi_id).laporan += 1;
  for (const r of trx) {
    const row = ensure(r.divisi_id);
    if (r.jenis_transaksi === "pemasukan") row.pemasukan += r.nominal;
    else row.pengeluaran += r.nominal;
  }
  for (const r of inv) ensure(r.divisi_id).inventaris += 1;
  for (const r of pro) ensure(r.divisi_id).program += 1;
  for (const r of kendalaRows) {
    const id = r.laporan_harian?.divisi_id;
    if (id) ensure(id).kendala += 1;
  }

  const rows = [...byDivisi.entries()].map(([id, r]) => ({
    divisi: name(id),
    laporan: r.laporan,
    kendala: r.kendala,
    pemasukan: rupiah(r.pemasukan),
    pengeluaran: rupiah(r.pengeluaran),
    saldo: rupiah(r.pemasukan - r.pengeluaran),
    inventaris: r.inventaris,
    program: r.program,
  }));

  return {
    columns: [
      { header: "Divisi", key: "divisi", width: 1.5 },
      { header: "Laporan", key: "laporan", width: 0.9, align: "right" },
      { header: "Kendala", key: "kendala", width: 0.9, align: "right" },
      { header: "Pemasukan", key: "pemasukan", width: 1.2, align: "right" },
      { header: "Pengeluaran", key: "pengeluaran", width: 1.2, align: "right" },
      { header: "Saldo", key: "saldo", width: 1.2, align: "right" },
      { header: "Inventaris", key: "inventaris", width: 1, align: "right" },
      { header: "Program", key: "program", width: 1, align: "right" },
    ],
    rows,
  };
}
