"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { fetchSaldoAwal } from "@/lib/finance";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ExportMenu } from "@/components/export-menu";
import { Eye } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["#10b981", "#ef4444", "#6366f1"];

export function RekapBulananClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [perDivisi, setPerDivisi] = useState<
    Array<{ id: string; nama: string; masuk: number; keluar: number }>
  >([]);
  const [saldoAwal, setSaldoAwal] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const year = String(filterYear);
      const month = String(filterMonth).padStart(2, "0");

      const { data: div } = await supabase.from("divisi").select("id, nama_divisi").order("nomor_divisi");
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("divisi_id, jenis_transaksi, nominal")
        .gte("tanggal", `${year}-${month}-01`)
        .lte("tanggal", endOfMonthISO(filterYear, filterMonth));

      const map = new Map<string, { masuk: number; keluar: number }>();
      (txs ?? []).forEach((t) => {
        const n = Number(t.nominal) || 0;
        if (!map.has(t.divisi_id)) map.set(t.divisi_id, { masuk: 0, keluar: 0 });
        const cur = map.get(t.divisi_id)!;
        if (t.jenis_transaksi === "pemasukan") cur.masuk += n;
        else cur.keluar += n;
      });

      setPerDivisi(
        (div ?? []).map((d) => ({
          id: d.id,
          nama: d.nama_divisi,
          masuk: map.get(d.id)?.masuk ?? 0,
          keluar: map.get(d.id)?.keluar ?? 0,
        }))
      );
      setSaldoAwal(await fetchSaldoAwal(supabase));
      setLoading(false);
    }
    load();
  }, [filterMonth, filterYear]);

  const totalMasuk = perDivisi.reduce((s, d) => s + d.masuk, 0);
  const totalKeluar = perDivisi.reduce((s, d) => s + d.keluar, 0);
  const saldoSekarang = saldoAwal + totalMasuk - totalKeluar;
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

  const chartData = perDivisi.map((d) => ({
    name: d.nama.replace("Divisi ", ""),
    Pemasukan: d.masuk,
    Pengeluaran: d.keluar,
  }));

  const pieData = [
    { name: "Pemasukan", value: totalMasuk },
    { name: "Pengeluaran", value: totalKeluar },
    { name: "Saldo", value: Math.max(0, saldoSekarang) },
  ].filter((d) => d.value > 0);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rekap Keuangan Bulanan</h1>

      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bulan">
              <Select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
                {MONTH_NAMES_ID.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tahun">
              <Select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
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

      {/* Saldo Awal & Saldo Sekarang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Saldo Awal</p>
            <p className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-400">{formatRupiah(saldoAwal)}</p>
            <p className="mt-1 text-xs text-slate-400">Diset pada fitur Transaksi oleh Bendahara</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Saldo Sekarang</p>
            <p className={`mt-1 text-2xl font-bold ${saldoSekarang >= 0 ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400"}`}>
              {formatRupiah(saldoSekarang)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Saldo Awal + Pemasukan - Pengeluaran</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(totalMasuk)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pengeluaran</p>
            <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{formatRupiah(totalKeluar)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Saldo</p>
            <p className={`mt-1 text-2xl font-bold ${saldoSekarang >= 0 ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400"}`}>
              {formatRupiah(saldoSekarang)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader title="Diagram Lingkaran" subtitle={`Pemasukan, Pengeluaran & Saldo - ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`} />
          <CardContent>
            <div className="flex justify-center">
              <div className="h-64 w-full max-w-[340px] sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="42%"
                      outerRadius="70%"
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatRupiah(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-600 dark:text-slate-400">{d.name}: {formatRupiah(d.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Diagram Pemasukan vs Pengeluaran"
          subtitle={`${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`}
        />
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Legend />
                <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Tabel per Divisi"
          action={
            <ExportMenu
              title={`Rekap Keuangan Bulanan per Divisi - ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`}
              subtitle={`Periode ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`}
              filename="rekap-keuangan-bulanan-per-divisi"
              disabled={perDivisi.length === 0}
              columns={[
                { header: "Divisi", key: "divisi", width: 24 },
                { header: "Pemasukan", key: "pemasukan", width: 20, align: "right" },
                { header: "Pengeluaran", key: "pengeluaran", width: 20, align: "right" },
                { header: "Saldo", key: "saldo", width: 20, align: "right" },
              ]}
              rows={[
                ...perDivisi.map((d) => ({
                  divisi: d.nama,
                  pemasukan: formatRupiah(d.masuk),
                  pengeluaran: formatRupiah(d.keluar),
                  saldo: formatRupiah(d.masuk - d.keluar),
                })),
                {
                  divisi: "TOTAL",
                  pemasukan: formatRupiah(totalMasuk),
                  pengeluaran: formatRupiah(totalKeluar),
                  saldo: formatRupiah(totalMasuk - totalKeluar),
                  __total: true,
                },
              ]}
            />
          }
        />
        <CardContent>
          <TableWrap minWidth={620}>
            <THead>
              <tr>
                <TH>Divisi</TH>
                <TH align="right">Pemasukan</TH>
                <TH align="right">Pengeluaran</TH>
                <TH align="right">Saldo</TH>
                <TH align="right">Detail</TH>
              </tr>
            </THead>
            <TBody>
              {perDivisi.map((d) => (
                <TR key={d.id}>
                  <TD className="min-w-[9rem] whitespace-nowrap font-medium">
                    {d.nama}
                  </TD>
                  <TD align="right" className="whitespace-nowrap">
                    {formatRupiah(d.masuk)}
                  </TD>
                  <TD align="right" className="whitespace-nowrap">
                    {formatRupiah(d.keluar)}
                  </TD>
                  <TD
                    align="right"
                    className={`whitespace-nowrap font-medium ${
                      d.masuk - d.keluar >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatRupiah(d.masuk - d.keluar)}
                  </TD>
                  <TD align="right" className="whitespace-nowrap">
                    <Link
                      href={`/dashboard/detail-keuangan?divisi=${encodeURIComponent(
                        d.id
                      )}&periode=bulanan`}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Eye className="h-3 w-3 text-slate-400" />
                      <span>Lihat Detail</span>
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
