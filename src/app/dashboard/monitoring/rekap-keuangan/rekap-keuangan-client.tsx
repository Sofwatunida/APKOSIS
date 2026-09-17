"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { FinanceSummary } from "@/components/finance-summary";
import { ExportMenu } from "@/components/export-menu";

export function RekapKeuanganClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState("all");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  const [financePerDivisi, setFinancePerDivisi] = useState<Record<string, { masuk: number; keluar: number }>>({});
  const [financeMonthly, setFinanceMonthly] = useState<{ masuk: number; keluar: number }>({ masuk: 0, keluar: 0 });
  const [allDivSaldo, setAllDivSaldo] = useState<Array<{ id: string; nama: string; masuk: number; keluar: number }>>([]);

  useEffect(() => {
    async function init() {
      const { data: div } = await supabase.from("divisi").select("id, nama_divisi").order("nomor_divisi");
      setDivisiOptions((div ?? []).map((d) => ({ id: d.id, nama: d.nama_divisi })));
    }
    init();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const year = String(filterYear);
      const month = String(filterMonth).padStart(2, "0");

      const startDate = `${year}-${month}-01`;
      const endDate = endOfMonthISO(filterYear, filterMonth);

      // Fetch all transactions for saldo keseluruhan (all time)
      const { data: allTxs } = await supabase
        .from("transaksi_keuangan")
        .select("divisi_id, jenis_transaksi, nominal");
      const allDivMap = new Map<string, { masuk: number; keluar: number }>();
      (allTxs ?? []).forEach((t) => {
        const n = Number(t.nominal) || 0;
        if (!allDivMap.has(t.divisi_id)) allDivMap.set(t.divisi_id, { masuk: 0, keluar: 0 });
        const cur = allDivMap.get(t.divisi_id)!;
        if (t.jenis_transaksi === "pemasukan") cur.masuk += n;
        else cur.keluar += n;
      });
      const divList = (await supabase.from("divisi").select("id, nama_divisi").order("nomor_divisi")).data ?? [];
      setAllDivSaldo(divList.map((d) => ({
        id: d.id,
        nama: d.nama_divisi,
        masuk: allDivMap.get(d.id)?.masuk ?? 0,
        keluar: allDivMap.get(d.id)?.keluar ?? 0,
      })));

      // Finance per divisi (filtered month)
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("divisi_id, tanggal, jenis_transaksi, nominal")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);
      const finMap: Record<string, { masuk: number; keluar: number }> = {};
      let totalMasuk = 0;
      let totalKeluar = 0;
      (txs ?? []).forEach((t) => {
        const n = Number(t.nominal) || 0;
        if (!finMap[t.divisi_id]) finMap[t.divisi_id] = { masuk: 0, keluar: 0 };
        if (t.jenis_transaksi === "pemasukan") {
          finMap[t.divisi_id].masuk += n;
          totalMasuk += n;
        } else {
          finMap[t.divisi_id].keluar += n;
          totalKeluar += n;
        }
      });
      setFinancePerDivisi(finMap);
      setFinanceMonthly({ masuk: totalMasuk, keluar: totalKeluar });
      setLoading(false);
    }
    load();
  }, [filterMonth, filterYear]);

  if (loading) return <Spinner />;

  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Rekap Keuangan</h1>

      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </div>
        </CardContent>
      </Card>

      <FinanceSummary title="Ringkasan Keuangan OSIS" />

      {/* Saldo Keseluruhan */}
      <Card>
        <CardHeader title="Saldo Keseluruhan Semua Divisi" subtitle="Total semua waktu" />
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allDivSaldo
              .filter((d) => filterDivisi === "all" || d.id === filterDivisi)
              .map((d) => {
                const saldo = d.masuk - d.keluar;
                return (
                  <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="font-semibold text-slate-800">{d.nama}</h4>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Pemasukan</span>
                        <span className="font-medium text-emerald-600">{formatRupiah(d.masuk)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Pengeluaran</span>
                        <span className="font-medium text-red-600">{formatRupiah(d.keluar)}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-1 flex justify-between text-xs">
                        <span className="text-slate-500">Saldo</span>
                        <span className={`font-bold ${saldo >= 0 ? "text-brand-600" : "text-red-600"}`}>{formatRupiah(saldo)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Pemasukan & Pengeluaran Bulanan per Divisi */}
      <Card>
        <CardHeader title={`Pemasukan & Pengeluaran per Divisi - ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`} />
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {divisiOptions
              .filter((d) => filterDivisi === "all" || d.id === filterDivisi)
              .map((d) => {
                const f = financePerDivisi[d.id] ?? { masuk: 0, keluar: 0 };
                return (
                  <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="font-semibold text-slate-800">{d.nama}</h4>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Pemasukan</span>
                        <span className="font-medium text-emerald-600">{formatRupiah(f.masuk)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Pengeluaran</span>
                        <span className="font-medium text-red-600">{formatRupiah(f.keluar)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pemasukan {MONTH_NAMES_ID[filterMonth - 1]}</p>
            <p className="text-2xl font-bold text-emerald-600">{formatRupiah(financeMonthly.masuk)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pengeluaran {MONTH_NAMES_ID[filterMonth - 1]}</p>
            <p className="text-2xl font-bold text-red-600">{formatRupiah(financeMonthly.keluar)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rekap Keuangan per Divisi + Export Button */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Rekap Keuangan per Divisi</h2>
            <p className="text-xs text-slate-500">{MONTH_NAMES_ID[filterMonth - 1]} {filterYear}</p>
          </div>
          {profile.role === "sekretaris" && (
            <ExportMenu
              title={`Rekap Keuangan per Divisi - ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`}
              subtitle={`Periode ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`}
              filename="rekap-keuangan-per-divisi"
              disabled={divisiOptions.length === 0}
              columns={[
                { header: "Divisi", key: "divisi", width: 24 },
                { header: "Pemasukan", key: "pemasukan", width: 20, align: "right" },
                { header: "Pengeluaran", key: "pengeluaran", width: 20, align: "right" },
                { header: "Saldo", key: "saldo", width: 20, align: "right" },
              ]}
              rows={divisiOptions
                .filter((d) => filterDivisi === "all" || d.id === filterDivisi)
                .map((d) => {
                  const f = financePerDivisi[d.id] ?? { masuk: 0, keluar: 0 };
                  return {
                    divisi: d.nama,
                    pemasukan: formatRupiah(f.masuk),
                    pengeluaran: formatRupiah(f.keluar),
                    saldo: formatRupiah(f.masuk - f.keluar),
                  };
                })}
            />
          )}
        </div>
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
                {divisiOptions
                  .filter((d) => filterDivisi === "all" || d.id === filterDivisi)
                  .map((d) => {
                    const f = financePerDivisi[d.id] ?? { masuk: 0, keluar: 0 };
                    const saldo = f.masuk - f.keluar;
                    return (
                      <tr key={d.id} className="border-b border-slate-50">
                        <td className="px-3 py-2 font-medium">{d.nama}</td>
                        <td className="px-3 py-2 text-right">{formatRupiah(f.masuk)}</td>
                        <td className="px-3 py-2 text-right">{formatRupiah(f.keluar)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatRupiah(saldo)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}