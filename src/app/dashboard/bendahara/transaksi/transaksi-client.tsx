"use client";

import { useEffect, useState } from "react";
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

interface Row extends TransaksiKeuangan {
  divisi: { nama_divisi: string } | null;
}

export function BendaharaTransaksiClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const currentYear = new Date().getFullYear();

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

  const [saldoAwal, setSaldoAwal] = useState(0);
  const [editingSaldo, setEditingSaldo] = useState(false);
  const [saldoInput, setSaldoInput] = useState("");
  const [savingSaldo, setSavingSaldo] = useState(false);

  async function loadSaldoAwal() {
    const { data } = await supabase
      .from("saldo_awal")
      .select("nominal")
      .eq("id", 1)
      .maybeSingle();
    setSaldoAwal(Number(data?.nominal) || 0);
  }

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
      const { data: div } = await supabase.from("divisi").select("id, nama_divisi").order("nomor_divisi");
      setDivisiOptions((div ?? []).map((d) => ({ id: d.id, nama: d.nama_divisi })));
      await loadSaldoAwal();
    }
    init();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveSaldoAwal() {
    const nominal = Number(saldoInput);
    if (isNaN(nominal) || nominal < 0) {
      error("Nominal saldo awal tidak valid.");
      return;
    }
    setSavingSaldo(true);
    const user = (await supabase.auth.getUser()).data.user;
    const payload = {
      id: 1,
      nominal,
      updated_by: user?.id ?? null,
    };
    const { error: upErr } = await supabase.from("saldo_awal").upsert(payload, { onConflict: "id" });
    if (upErr) {
      setSavingSaldo(false);
      error("Gagal menyimpan saldo awal: " + upErr.message);
      return;
    }
    setSaldoAwal(nominal);
    setEditingSaldo(false);
    setSavingSaldo(false);
    success("Saldo awal berhasil disimpan.");
  }

  useEffect(() => {
    load();
    const t = setTimeout(() => {}, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDivisi, filterJenis, filterTanggal, filterBulan, filterTahun]);

  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

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

      {/* Saldo Awal Setting */}
      <Card>
        <CardHeader
          title="Saldo Awal"
          subtitle="Set saldo awal kas OSIS. Nilai konstan sampai di-edit kembali."
        />
        <CardContent>
          {!editingSaldo ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Saldo Awal Tersimpan</p>
                <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">
                  {formatRupiah(saldoAwal)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Saldo ini dipakai di semua role untuk menghitung saldo OSIS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSaldoInput(saldoAwal === 0 ? "" : String(saldoAwal));
                  setEditingSaldo(true);
                }}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition hover:from-brand-500 hover:to-indigo-500 active:scale-[0.98]"
              >
                Edit Saldo Awal
              </button>
            </div>
          ) : (
            <div className="max-w-sm space-y-4">
              <Field label="Nominal Saldo Awal (Rp)">
                <Input
                  type="number"
                  min="0"
                  value={saldoInput}
                  onChange={(e) => setSaldoInput(e.target.value)}
                  placeholder="Ketik nominal saldo awal..."
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveSaldoAwal} loading={savingSaldo} size="sm">
                  {savingSaldo ? "Menyimpan..." : "Simpan Saldo Awal"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSaldo(false)}
                >
                  Batal
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Pemasukan" value={formatRupiah(pemasukan)} tone="green" />
        <StatCard label="Total Pengeluaran" value={formatRupiah(pengeluaran)} tone="red" />
        <StatCard label="Saldo Awal" value={formatRupiah(saldoAwal)} tone="indigo" />
        <StatCard
          label="Saldo"
          sub="Saldo Awal + Masuk - Keluar"
          value={formatRupiah(saldoAwal + pemasukan - pengeluaran)}
          tone={saldoAwal + pemasukan - pengeluaran >= 0 ? "brand" : "red"}
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
