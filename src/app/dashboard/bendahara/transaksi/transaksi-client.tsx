"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { stripBukti, parseBukti } from "@/lib/bukti";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { BuktiButton, BuktiPreviewModal } from "@/components/ui/bukti";
import { useToast } from "@/components/ui/toast";
import { ExportMenu } from "@/components/export-menu";
import { usePeriode } from "@/lib/periode-context";
import { saveSaldoAwalAction } from "../../actions/saldo-actions";
import { buildDivisiOptions } from "@/lib/divisi-options";

interface Row extends TransaksiKeuangan {
  divisi: { nama_divisi: string } | null;
}

interface SaldoRow {
  divisiId: string;
  nomor: number;
  nama: string;
  nominal: number;
}

export function BendaharaTransaksiClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const { readOnly, options: periodeOptions } = usePeriode();
  // Tahun filter TIDAK lagi memakai tahun kalender, melainkan tahun
  // milik periode yang dipilih (dari tabel `periods`).
  const periodeTahun = useMemo(() => {
    const now = new Date().getFullYear();
    const nowMonth = now - 1; // 0 = Januari
    const years: number[] = [];
    for (const p of periodeOptions) {
      for (let y = p.tahunMulai; y <= p.tahunSelesai; y++) years.push(y);
    }
    const active = periodeOptions.find((p) => p.status === "active");
    if (active && now >= active.tahunMulai && now <= active.tahunSelesai) {
      return now;
    }
    if (active) return active.tahunMulai;
    void nowMonth;
    return years[0] ?? now;
  }, [periodeOptions]);

  const currentYear = periodeTahun;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState("all");
  const [filterJenis, setFilterJenis] = useState("all");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [filterBulan, setFilterBulan] = useState("all");
  const [filterTahun, setFilterTahun] = useState(String(currentYear));

  const [rows, setRows] = useState<Row[]>([]);
  const [pemasukan, setPemasukan] = useState(0);
  const [pengeluaran, setPengeluaran] = useState(0);
  const [viewBukti, setViewBukti] = useState<string | null>(null);

  const [saldoRows, setSaldoRows] = useState<SaldoRow[]>([]);
  const [saldoDivisiId, setSaldoDivisiId] = useState("");
  const [saldoInput, setSaldoInput] = useState("");
  const [savingSaldo, setSavingSaldo] = useState(false);

  async function loadSaldoAwal(
    divRows: { id: string; nomor_divisi: number | null; nama_divisi: string | null }[]
  ) {
    const { data } = await supabase
      .from("saldo_awal")
      .select("divisi_id, nominal");

    const byDivisi = new Map<string, number>();
    (data ?? []).forEach((row) => {
      if (row.divisi_id) {
        byDivisi.set(row.divisi_id, Number(row.nominal) || 0);
      }
    });

    // Hanya divisi nyata (bukan uuid placeholder) yang bisa menyimpan saldo.
    const seen = new Set<number>();
    const list: SaldoRow[] = [];
    for (const d of divRows) {
      const nomor = typeof d.nomor_divisi === "number" ? d.nomor_divisi : null;
      if (nomor !== null) {
        if (seen.has(nomor)) continue;
        seen.add(nomor);
      }
      list.push({
        divisiId: d.id,
        nomor: nomor ?? Number.MAX_SAFE_INTEGER,
        nama:
          (d.nama_divisi ?? "").trim() ||
          (nomor !== null ? `Divisi ${String(nomor).padStart(2, "0")}` : "-"),
        nominal: byDivisi.get(d.id) ?? 0,
      });
    }
    list.sort((a, b) => a.nomor - b.nomor);

    setSaldoRows(list);
    if (list.length > 0) {
      setSaldoDivisiId((prev) => prev || list[0].divisiId);
      setSaldoInput((prev) =>
        prev || (list[0].nominal !== 0 ? String(list[0].nominal) : "")
      );
    }
  }

  function handleSaldoDivisiChange(divisiId: string) {
    setSaldoDivisiId(divisiId);
    const row = saldoRows.find((r) => r.divisiId === divisiId);
    setSaldoInput(row && row.nominal !== 0 ? String(row.nominal) : "");
  }

  const totalSaldoAwal = useMemo(
    () => saldoRows.reduce((total, row) => total + row.nominal, 0),
    [saldoRows]
  );

  async function load() {
    setLoading(true);
    let query = supabase
      .from("transaksi_keuangan")
      .select("*, divisi(nama_divisi)")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (filterDivisi !== "all") query = query.eq("divisi_id", filterDivisi);
    if (filterJenis !== "all")
      query = query.eq("jenis_transaksi", filterJenis as "pemasukan" | "pengeluaran");
    if (filterTanggal) query = query.eq("tanggal", filterTanggal);
    if (filterBulan !== "all") {
      const bNum = parseInt(filterBulan, 10);
      const tNum = parseInt(filterTahun, 10);
      query = query
        .gte("tanggal", `${filterTahun}-${filterBulan}-01`)
        .lte("tanggal", endOfMonthISO(tNum, bNum));
    } else if (filterTahun) {
      query = query.gte("tanggal", `${filterTahun}-01-01`).lte("tanggal", `${filterTahun}-12-31`);
    }

    const { data } = await query;
    const list = (data ?? []) as Row[];
    let masuk = 0;
    let keluar = 0;
    list.forEach((t) => {
      const n = Number(t.nominal) || 0;
      if (t.jenis_transaksi === "pemasukan") masuk += n;
      else keluar += n;
    });
    setRows(list);
    setPemasukan(masuk);
    setPengeluaran(keluar);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const { data: div } = await supabase
        .from("divisi")
        .select("id, nomor_divisi, nama_divisi")
        .order("nomor_divisi");
      // Dropdown selalu lengkap: "Semua Divisi" + Divisi 01 .. Divisi 20.
      setDivisiOptions(buildDivisiOptions(div));
      await loadSaldoAwal(div ?? []);
    }
    init();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveSaldoAwal() {
    const nominal = Number(saldoInput);
    if (!saldoDivisiId) {
      error("Pilih divisi terlebih dahulu.");
      return;
    }
    if (isNaN(nominal) || nominal < 0) {
      error("Nominal saldo awal tidak valid.");
      return;
    }
    if (readOnly) {
      error("Periode arsip tidak bisa diubah.");
      return;
    }
    setSavingSaldo(true);
    const fd = new FormData();
    fd.set("divisi_id", saldoDivisiId);
    fd.set("nominal", String(nominal));
    const result = await saveSaldoAwalAction(fd);
    setSavingSaldo(false);
    if (!result.ok) {
      error(result.message);
      return;
    }
    setSaldoRows((prev) =>
      prev.map((row) =>
        row.divisiId === saldoDivisiId ? { ...row, nominal } : row
      )
    );
    success(result.message);
  }

  useEffect(() => {
    load();
    const t = setTimeout(() => {}, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDivisi, filterJenis, filterTanggal, filterBulan, filterTahun]);

  // Daftar tahun diambil dari tabel `periods`, bukan daftar hardcoded.
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (const p of periodeOptions) {
      for (let y = p.tahunMulai; y <= p.tahunSelesai; y++) years.push(y);
    }
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [periodeOptions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaksi Keuangan"
        description="Seluruh mutasi kas masuk dan keluar OSIS beserta bukti struk transaksi."
      />

      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Divisi">
              <Select value={filterDivisi} onChange={(e) => setFilterDivisi(e.target.value)}>
                <option value="all">Semua Divisi</option>
                {divisiOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jenis Transaksi">
              <Select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}>
                <option value="all">Semua</option>
                <option value="pemasukan">Pemasukan</option>
                <option value="pengeluaran">Pengeluaran</option>
              </Select>
            </Field>
            <Field label="Tanggal">
              <Input type="date" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} />
            </Field>
            <Field label="Bulan">
              <Select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
                <option value="all">Semua Bulan</option>
                {MONTH_NAMES_ID.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tahun">
              <Select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Saldo Awal per Divisi */}
      <Card>
        <CardHeader
          title="Saldo Awal per Divisi"
          subtitle="Atur saldo awal kas setiap divisi pada periode ini."
        />
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
            <Field label="Divisi">
              <Select
                value={saldoDivisiId}
                disabled={readOnly || savingSaldo || saldoRows.length === 0}
                onChange={(e) => handleSaldoDivisiChange(e.target.value)}
              >
                {saldoRows.length === 0 && (
                  <option value="">Belum ada divisi</option>
                )}
                {saldoRows.map((row) => (
                  <option key={row.divisiId} value={row.divisiId}>
                    {row.nama}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nominal Saldo Awal (Rp)">
              <Input
                type="number"
                min="0"
                value={saldoInput}
                disabled={readOnly || savingSaldo || saldoRows.length === 0}
                onChange={(e) => setSaldoInput(e.target.value)}
                placeholder="Ketik nominal saldo awal..."
              />
            </Field>
            <Button
              type="button"
              onClick={handleSaveSaldoAwal}
              loading={savingSaldo}
              disabled={readOnly || saldoRows.length === 0}
              className="self-end"
            >
              Simpan Saldo Awal
            </Button>
          </div>

          <TableWrap minWidth={420}>
            <THead>
              <tr>
                <TH>Divisi</TH>
                <TH align="right">Saldo Awal</TH>
              </tr>
            </THead>
            <TBody>
              {saldoRows.map((row) => (
                <TR key={row.divisiId}>
                  <TD className="font-medium">{row.nama}</TD>
                  <TD align="right" className="whitespace-nowrap">
                    {formatRupiah(row.nominal)}
                  </TD>
                </TR>
              ))}
              {saldoRows.length === 0 && (
                <TR>
                  <TD
                    colSpan={2}
                    className="py-6 text-center text-sm text-slate-400"
                  >
                    Belum ada divisi.
                  </TD>
                </TR>
              )}
            </TBody>
          </TableWrap>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Total Saldo Awal
            </span>
            <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
              {formatRupiah(totalSaldoAwal)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Pemasukan" value={formatRupiah(pemasukan)} tone="green" />
        <StatCard label="Total Pengeluaran" value={formatRupiah(pengeluaran)} tone="red" />
        <StatCard label="Saldo Awal" value={formatRupiah(totalSaldoAwal)} tone="indigo" />
        <StatCard
          label="Saldo"
          sub="Saldo Awal + Masuk - Keluar"
          value={formatRupiah(totalSaldoAwal + pemasukan - pengeluaran)}
          tone={totalSaldoAwal + pemasukan - pengeluaran >= 0 ? "brand" : "red"}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar Transaksi"
          action={
            <ExportMenu
              title="Transaksi Keuangan"
              filename="transaksi-keuangan"
              disabled={rows.length === 0}
              columns={[
                { header: "Tanggal", key: "tanggal", width: 14 },
                { header: "Divisi", key: "divisi", width: 24 },
                { header: "Jenis", key: "jenis", width: 14 },
                { header: "Keterangan", key: "keterangan", width: 40 },
                { header: "Nominal", key: "nominal", width: 20, align: "right" },
              ]}
              rows={rows.map((t) => ({
                tanggal: formatDate(t.tanggal),
                divisi: t.divisi?.nama_divisi ?? "-",
                jenis: t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran",
                keterangan: stripBukti(t.keterangan) || "-",
                nominal: formatRupiah(t.nominal),
              }))}
            />
          }
        />
        <CardContent>
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState title="Tidak ada transaksi" description="Atur filter untuk melihat transaksi." />
          ) : (
            <TableWrap minWidth={720}>
              <THead>
                <tr>
                  <TH>Tanggal</TH>
                  <TH>Divisi</TH>
                  <TH>Jenis</TH>
                  <TH>Keterangan</TH>
                  <TH>Bukti</TH>
                  <TH align="right">Nominal</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((t) => {
                  const { cleanKeterangan, buktiRef } = parseBukti(t.keterangan);
                  return (
                    <TR key={t.id}>
                      <TD className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(t.tanggal)}
                      </TD>
                      <TD className="font-medium text-slate-900 dark:text-white">
                        {t.divisi?.nama_divisi ?? "-"}
                      </TD>
                      <TD>
                        <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                          {t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
                        </Badge>
                      </TD>
                      <TD className="max-w-[18rem] text-xs text-slate-600 dark:text-slate-400">
                        <span className="safe-text block">{cleanKeterangan || "-"}</span>
                      </TD>
                      <TD>
                        <BuktiButton buktiRef={buktiRef} onOpen={setViewBukti} />
                      </TD>
                      <TD
                        align="right"
                        className="whitespace-nowrap font-semibold text-slate-900 dark:text-white"
                      >
                        {formatRupiah(t.nominal)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <BuktiPreviewModal buktiRef={viewBukti} onClose={() => setViewBukti(null)} />
    </div>
  );
}
