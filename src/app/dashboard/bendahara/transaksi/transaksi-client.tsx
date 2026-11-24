"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  SEMUA_DIVISI_VALUE,
  buildDivisiOptions,
  formatDivisiLabel,
  getDivisiFilterLabel,
  isSemuaDivisi,
} from "@/lib/divisi-options";
import { SALDO_BENDAHARA_TARGET } from "@/lib/finance";

const SALDO_BENDAHARA_LABEL = "Bendahara (Kas Pusat)";

interface Row extends TransaksiKeuangan {
  divisi: { nomor_divisi: number | null; nama_divisi: string } | null;
}

function divisiLabel(divisi: Row["divisi"]): string {
  if (!divisi) return "-";
  return formatDivisiLabel(divisi.nomor_divisi, divisi.nama_divisi || "-");
}

interface SaldoRow {
  divisiId: string;
  nomor: number;
  nama: string;
  nominal: number;
  exists: boolean;
}

export function BendaharaTransaksiClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const { readOnly, options: periodeOptions, periodeId } = usePeriode();
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
  const initialLoadRef = useRef(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState(SEMUA_DIVISI_VALUE);
  const [filterJenis, setFilterJenis] = useState("all");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [filterBulan, setFilterBulan] = useState("all");
  const [filterTahun, setFilterTahun] = useState(String(currentYear));

  const [rows, setRows] = useState<Row[]>([]);
  const [pemasukan, setPemasukan] = useState(0);
  const [pengeluaran, setPengeluaran] = useState(0);
  const [viewBukti, setViewBukti] = useState<string | null>(null);

  const [saldoRows, setSaldoRows] = useState<SaldoRow[]>([]);
  const [saldoBendahara, setSaldoBendahara] = useState(0);
  const [saldoBendaharaExists, setSaldoBendaharaExists] = useState(false);
  const [divisiRaw, setDivisiRaw] = useState<
    { id: string; nomor_divisi: number | null; nama_divisi: string | null }[]
  >([]);
  const [saldoDivisiId, setSaldoDivisiId] = useState("");
  const [saldoInput, setSaldoInput] = useState("");
  const [saldoEditing, setSaldoEditing] = useState(false);
  const [savingSaldo, setSavingSaldo] = useState(false);

  async function loadSaldoAwal(
    divRows: { id: string; nomor_divisi: number | null; nama_divisi: string | null }[]
  ) {
    const { data } = await supabase
      .from("saldo_awal")
      .select("divisi_id, nominal");

    const byDivisi = new Map<string, number>();
    let bendahara = 0;
    let bendaharaExists = false;
    (data ?? []).forEach((row) => {
      if (row.divisi_id) {
        byDivisi.set(row.divisi_id, Number(row.nominal) || 0);
      } else {
        bendahara = Number(row.nominal) || 0;
        bendaharaExists = true;
      }
    });
    setSaldoBendahara(bendahara);
    setSaldoBendaharaExists(bendaharaExists);

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
        nama: formatDivisiLabel(nomor, d.nama_divisi || "-"),
        nominal: byDivisi.get(d.id) ?? 0,
        exists: byDivisi.has(d.id),
      });
    }
    list.sort((a, b) => a.nomor - b.nomor);

    setSaldoRows(list);
    setSaldoDivisiId((prev) => {
      if (
        prev === SALDO_BENDAHARA_TARGET ||
        list.some((row) => row.divisiId === prev)
      ) {
        return prev;
      }
      return SALDO_BENDAHARA_TARGET;
    });
  }

  /** Nominal terakhir yang tersimpan untuk tujuan yang sedang dipilih. */
  function currentSaldoTarget() {
    if (saldoDivisiId === SALDO_BENDAHARA_TARGET) {
      return { nominal: saldoBendahara, exists: saldoBendaharaExists };
    }
    const row = saldoRows.find((r) => r.divisiId === saldoDivisiId);
    return { nominal: row?.nominal ?? 0, exists: row?.exists ?? false };
  }

  function handleSaldoDivisiChange(divisiId: string) {
    setSaldoDivisiId(divisiId);
    setSaldoEditing(false);
    if (divisiId === SALDO_BENDAHARA_TARGET) {
      setSaldoInput(saldoBendaharaExists ? String(saldoBendahara) : "");
      return;
    }
    const row = saldoRows.find((r) => r.divisiId === divisiId);
    setSaldoInput(row?.exists ? String(row.nominal) : "");
  }

  function startEditSaldo() {
    const current = currentSaldoTarget();
    setSaldoInput(current.exists ? String(current.nominal) : "");
    setSaldoEditing(true);
  }

  function cancelEditSaldo() {
    setSaldoEditing(false);
  }

  // Saat tidak sedang mengedit, input selalu menampilkan nilai terakhir
  // yang tersimpan (termasuk setelah ganti tujuan atau selesai menyimpan).
  useEffect(() => {
    if (saldoEditing) return;
    if (saldoDivisiId === SALDO_BENDAHARA_TARGET) {
      setSaldoInput(saldoBendaharaExists ? String(saldoBendahara) : "");
      return;
    }
    const row = saldoRows.find((r) => r.divisiId === saldoDivisiId);
    setSaldoInput(row?.exists ? String(row.nominal) : "");
  }, [
    saldoEditing,
    saldoDivisiId,
    saldoBendahara,
    saldoBendaharaExists,
    saldoRows,
  ]);

  const totalSaldoAwal = useMemo(
    () =>
      saldoBendahara + saldoRows.reduce((total, row) => total + row.nominal, 0),
    [saldoBendahara, saldoRows]
  );

  async function load() {
    setLoading(true);
    let query = supabase
      .from("transaksi_keuangan")
      .select("*, divisi(nomor_divisi, nama_divisi)")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (!isSemuaDivisi(filterDivisi)) query = query.eq("divisi_id", filterDivisi);
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
      setDivisiOptions(buildDivisiOptions(div));
      setDivisiRaw(div ?? []);
      await loadSaldoAwal(div ?? []);
    }
    init();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saat periode diganti, muat ulang saldo awal supaya nominal periode
  // sebelumnya tidak terbawa ke periode yang baru.
  useEffect(() => {
    if (!periodeId || divisiRaw.length === 0) return;
    setSaldoEditing(false);
    void loadSaldoAwal(divisiRaw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeId]);

  async function handleSaveSaldoAwal() {
    const nominal = Number(saldoInput);
    if (!saldoDivisiId) {
      error("Pilih tujuan saldo awal terlebih dahulu.");
      return;
    }
    if (saldoInput.trim() === "") {
      error("Nominal saldo awal wajib diisi.");
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
    const isBendahara = saldoDivisiId === SALDO_BENDAHARA_TARGET;
    const fd = new FormData();
    fd.set("target", isBendahara ? "bendahara" : "divisi");
    if (!isBendahara) fd.set("divisi_id", saldoDivisiId);
    fd.set("nominal", String(nominal));
    const result = await saveSaldoAwalAction(fd);
    setSavingSaldo(false);
    if (!result.ok) {
      error(result.message);
      return;
    }
    setSaldoEditing(false);
    // Baca ulang dari database supaya tampilan Monitoring/Bendahara
    // sama-sama memakai nilai terbaru, bukan asumsi state lokal.
    await loadSaldoAwal(divisiRaw);
    success(result.message);
  }

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
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

  const saldoTarget = currentSaldoTarget();
  const saldoTargetLabel =
    saldoDivisiId === SALDO_BENDAHARA_TARGET
      ? SALDO_BENDAHARA_LABEL
      : saldoRows.find((r) => r.divisiId === saldoDivisiId)?.nama ?? "-";
  const filterDivisiLabel = getDivisiFilterLabel(filterDivisi, divisiOptions);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaksi Keuangan"
      />

      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Divisi">
              <Select value={filterDivisi} onChange={(e) => setFilterDivisi(e.target.value)}>
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
          title="Saldo Awal Bendahara & Divisi"
        />
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
            <Field label="Tujuan Saldo Awal">
              <Select
                value={saldoDivisiId}
                disabled={readOnly || savingSaldo}
                onChange={(e) => handleSaldoDivisiChange(e.target.value)}
              >
                <option value={SALDO_BENDAHARA_TARGET}>
                  {SALDO_BENDAHARA_LABEL}
                </option>
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
                step="0.01"
                value={saldoInput}
                disabled={readOnly || savingSaldo || !saldoEditing}
                onChange={(e) => setSaldoInput(e.target.value)}
                placeholder="Ketik nominal saldo awal..."
              />
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              {saldoEditing ? (
                <>
                  <Button
                    type="button"
                    onClick={handleSaveSaldoAwal}
                    loading={savingSaldo}
                    disabled={readOnly}
                  >
                    Simpan Perubahan
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEditSaldo}
                    disabled={savingSaldo}
                  >
                    Batal
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant={saldoTarget.exists ? "outline" : "primary"}
                  onClick={startEditSaldo}
                  disabled={readOnly || savingSaldo}
                >
                  {saldoTarget.exists ? "Edit Saldo Awal" : "Tambah Saldo Awal"}
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {saldoTarget.exists ? (
              <>
                Saldo awal tersimpan untuk{" "}
                <span className="font-semibold">{saldoTargetLabel}</span> pada
                periode ini: {formatRupiah(saldoTarget.nominal)}.
              </>
            ) : (
              <>
                Saldo awal <span className="font-semibold">{saldoTargetLabel}</span>{" "}
                belum diatur pada periode ini. Klik{" "}
                <span className="font-semibold">Tambah Saldo Awal</span> untuk
                mengisinya.
              </>
            )}
          </p>

          <TableWrap minWidth={420}>
            <THead>
              <tr>
                <TH>Divisi</TH>
                <TH align="right">Saldo Awal</TH>
              </tr>
            </THead>
            <TBody>
              <TR>
                <TD className="font-medium">{SALDO_BENDAHARA_LABEL}</TD>
                <TD align="right" className="whitespace-nowrap">
                  {formatRupiah(saldoBendahara)}
                </TD>
              </TR>
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
        <StatCard
          label="Saldo Awal"
          value={formatRupiah(totalSaldoAwal)}
          tone="indigo"
        />
        <StatCard
          label="Saldo"
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
              subtitle={`Divisi: ${filterDivisiLabel}`}
              division={filterDivisiLabel}
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
                divisi: divisiLabel(t.divisi),
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
                        {divisiLabel(t.divisi)}
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
