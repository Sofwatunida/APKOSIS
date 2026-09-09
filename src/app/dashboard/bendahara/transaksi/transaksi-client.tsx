"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";

interface Row extends TransaksiKeuangan {
  divisi: { nama_divisi: string } | null;
}

export function BendaharaTransaksiClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
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
    }
    init();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <h1 className="text-2xl font-bold text-slate-900">Transaksi Keuangan</h1>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatRupiah(pemasukan)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pengeluaran</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatRupiah(pengeluaran)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Saldo</p>
            <p className={`mt-1 text-2xl font-bold ${pemasukan - pengeluaran >= 0 ? "text-brand-600" : "text-red-600"}`}>
              {formatRupiah(pemasukan - pengeluaran)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Daftar Transaksi" />
        <CardContent>
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState title="Tidak ada transaksi" description="Atur filter untuk melihat transaksi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Divisi</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Keterangan</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.tanggal)}</td>
                      <td className="px-3 py-2 font-medium">{t.divisi?.nama_divisi ?? "-"}</td>
                      <td className="px-3 py-2">
                        <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                          {t.jenis_transaksi}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{t.keterangan}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatRupiah(t.nominal)}</td>
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
