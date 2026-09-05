"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
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
      setLoading(false);
    }
    load();
  }, [filterYear]);

  const totalMasuk = byMonth.reduce((s, d) => s + d.masuk, 0);
  const totalKeluar = byMonth.reduce((s, d) => s + d.keluar, 0);
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

  const chartData = byMonth.map((d, i) => ({
    name: MONTH_NAMES_ID[i].slice(0, 3),
    Pemasukan: d.masuk,
    Pengeluaran: d.keluar,
  }));

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Rekap Keuangan Tahunan</h1>

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
            <p className="text-sm text-slate-500">Total Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatRupiah(totalMasuk)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Pengeluaran</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatRupiah(totalKeluar)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Saldo</p>
            <p className={`mt-1 text-2xl font-bold ${totalMasuk - totalKeluar >= 0 ? "text-brand-600" : "text-red-600"}`}>
              {formatRupiah(totalMasuk - totalKeluar)}
            </p>
          </CardContent>
        </Card>
      </div>

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
        <CardHeader title="Tabel Bulanan" />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Bulan</th>
                  <th className="px-3 py-2 text-right">Pemasukan</th>
                  <th className="px-3 py-2 text-right">Pengeluaran</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map((d, i) => (
                  <tr key={d.month} className="border-b border-slate-50">
                    <td className="px-3 py-2 font-medium">{MONTH_NAMES_ID[i]}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(d.masuk)}</td>
                    <td className="px-3 py-2 text-right">{formatRupiah(d.keluar)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${d.masuk - d.keluar >= 0 ? "text-emerald-600" : "text-red-600"}`}>
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
