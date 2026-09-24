"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID } from "@/lib/date";
import { fetchSaldoAwal } from "@/lib/finance";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { ExportMenu } from "@/components/export-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export function RekapTahunanClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [byMonth, setByMonth] = useState<Array<{ month: string; masuk: number; keluar: number }>>([]);
  const [yearlyData, setYearlyData] = useState<Array<{ year: string; Pemasukan: number; Pengeluaran: number }>>([]);
  const [saldoAwal, setSaldoAwal] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("tanggal, jenis_transaksi, nominal")
        .gte("tanggal", `${filterYear}-01-01`)
        .lte("tanggal", `${filterYear}-12-31`);

      const map = new Map<string, { masuk: number; keluar: number }>();
      MONTHS.forEach((m) => map.set(m, { masuk: 0, keluar: 0 }));
      (txs ?? []).forEach((t) => {
        const m = t.tanggal.slice(5, 7);
        const n = Number(t.nominal) || 0;
        const cur = map.get(m) ?? { masuk: 0, keluar: 0 };
        if (t.jenis_transaksi === "pemasukan") cur.masuk += n;
        else cur.keluar += n;
        map.set(m, cur);
      });

      setByMonth(
        MONTHS.map((m) => ({ month: m, masuk: map.get(m)!.masuk, keluar: map.get(m)!.keluar }))
      );
      setSaldoAwal(await fetchSaldoAwal(supabase));

      // Load multi-year data for the yearly comparison chart
      const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
      const yearResults: Array<{ year: string; Pemasukan: number; Pengeluaran: number }> = [];
      for (const y of years) {
        const { data: yTxs } = await supabase
          .from("transaksi_keuangan")
          .select("jenis_transaksi, nominal")
          .gte("tanggal", `${y}-01-01`)
          .lte("tanggal", `${y}-12-31`);
        let masuk = 0;
        let keluar = 0;
        (yTxs ?? []).forEach((t) => {
          const n = Number(t.nominal) || 0;
          if (t.jenis_transaksi === "pemasukan") masuk += n;
          else keluar += n;
        });
        yearResults.push({ year: String(y), Pemasukan: masuk, Pengeluaran: keluar });
      }
      setYearlyData(yearResults.reverse());
      setLoading(false);
    }
    load();
  }, [filterYear]);

  const totalMasuk = byMonth.reduce((s, d) => s + d.masuk, 0);
  const totalKeluar = byMonth.reduce((s, d) => s + d.keluar, 0);
  const saldoTotal = saldoAwal + totalMasuk - totalKeluar;
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

  const chartData = byMonth.map((d, i) => ({
    name: MONTH_NAMES_ID[i].slice(0, 3),
    Pemasukan: d.masuk,
    Pengeluaran: d.keluar,
  }));

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rekap Keuangan Tahunan</h1>

      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:max-w-xs">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(totalMasuk)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Pengeluaran</p>
            <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{formatRupiah(totalKeluar)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Saldo (termasuk Saldo Awal)</p>
            <p className={`mt-1 text-2xl font-bold ${saldoTotal >= 0 ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400"}`}>
              {formatRupiah(saldoTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Diagram Batang Perbandingan Tahunan */}
      <Card>
        <CardHeader title="Diagram Batang Pemasukan & Pengeluaran per Tahun" subtitle="5 Tahun Terakhir" />
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" />
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
        <CardHeader title="Diagram Pemasukan & Pengeluaran per Bulan" subtitle={`Tahun ${filterYear}`} />
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
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
          title="Tabel Bulanan"
          action={
            <ExportMenu
              title={`Rekap Keuangan Tahunan - ${filterYear}`}
              subtitle={`Periode tahun ${filterYear}`}
              filename="rekap-keuangan-tahunan"
              disabled={byMonth.length === 0}
              columns={[
                { header: "Bulan", key: "bulan", width: 18 },
                { header: "Pemasukan", key: "pemasukan", width: 20, align: "right" },
                { header: "Pengeluaran", key: "pengeluaran", width: 20, align: "right" },
                { header: "Saldo", key: "saldo", width: 20, align: "right" },
              ]}
              rows={byMonth.map((d, i) => ({
                bulan: MONTH_NAMES_ID[i],
                pemasukan: formatRupiah(d.masuk),
                pengeluaran: formatRupiah(d.keluar),
                saldo: formatRupiah(d.masuk - d.keluar),
              }))}
            />
          }
        />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Bulan</th>
                  <th className="px-3 py-2 text-right">Pemasukan</th>
                  <th className="px-3 py-2 text-right">Pengeluaran</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map((d, i) => (
                  <tr key={d.month} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-3 py-2 font-medium">{MONTH_NAMES_ID[i]}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(d.masuk)}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(d.keluar)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${d.masuk - d.keluar >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatRupiah(d.masuk - d.keluar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
