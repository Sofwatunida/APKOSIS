"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
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
  const [editingSaldo, setEditingSaldo] = useState(false);
  const [saldoInput, setSaldoInput] = useState("0");

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
      <h1 className="text-2xl font-bold text-slate-900">Rekap Keuangan Bulanan</h1>

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
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Saldo Awal</p>
              {!editingSaldo ? (
                <button
                  type="button"
                  onClick={() => {
                    setSaldoInput(String(saldoAwal));
                    setEditingSaldo(true);
                  }}
                  className="text-xs text-brand-600 hover:underline font-medium"
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingSaldo(false)}
                  className="text-xs text-slate-500 hover:underline font-medium"
                >
                  Selesai
                </button>
              )}
            </div>
            {editingSaldo ? (
              <div className="mt-2">
                <Input
                  type="number"
                  value={saldoInput}
                  onChange={(e) => setSaldoInput(e.target.value)}
                  className="text-2xl font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSaldoAwal(Number(saldoInput) || 0);
                    setEditingSaldo(false);
                  }}
                  className="mt-2 rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Simpan
                </button>
              </div>
            ) : (
              <p className="mt-1 text-2xl font-bold text-brand-600">{formatRupiah(saldoAwal)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Saldo Sekarang</p>
            <p className={`mt-1 text-2xl font-bold ${saldoSekarang >= 0 ? "text-brand-600" : "text-red-600"}`}>
              {formatRupiah(saldoSekarang)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Saldo Awal + Pemasukan - Pengeluaran</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatRupiah(totalMasuk)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pengeluaran</p>
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

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader title="Diagram Lingkaran" subtitle={`Pemasukan, Pengeluaran & Saldo - ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`} />
          <CardContent>
            <div className="flex justify-center">
              <div className="h-72 w-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
            <div className="mt-4 flex justify-center gap-6">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-600">{d.name}: {formatRupiah(d.value)}</span>
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
        <CardHeader title="Tabel per Divisi" />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Divisi</th>
                  <th className="px-3 py-2 text-right">Pemasukan</th>
                  <th className="px-3 py-2 text-right">Pengeluaran</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {perDivisi.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 font-medium">{d.nama}</td>
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
