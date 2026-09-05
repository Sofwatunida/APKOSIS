"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";

export function MonitoringRekapClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState("all");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  const [kendalaData, setKendalaData] = useState<Record<string, { kendala: string; solusi: string }[]>>({});
  const [financePerDivisi, setFinancePerDivisi] = useState<Record<string, { masuk: number; keluar: number }>>({});
  const [financeMonthly, setFinanceMonthly] = useState<{ masuk: number; keluar: number }>({ masuk: 0, keluar: 0 });

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

      const { data: reports } = await supabase
        .from("laporan_harian")
        .select("id, divisi_id, tanggal")
        .gte("tanggal", `${year}-${month}-01`)
        .lte("tanggal", `${year}-${month}-31`);
      const reportsList = reports ?? [];
      const reportIds = reportsList.map((r) => r.id);

      const ksMap: Record<string, { kendala: string; solusi: string }[]> = {};
      if (reportIds.length > 0) {
        const { data: ks } = await supabase
          .from("kendala_solusi")
          .select("laporan_id, kendala, solusi");
        const laporanToDivisi = new Map(reportsList.map((r) => [r.id, r.divisi_id]));
        (ks ?? []).forEach((k) => {
          const did = laporanToDivisi.get(k.laporan_id);
          if (!did) return;
          if (!ksMap[did]) ksMap[did] = [];
          ksMap[did].push({ kendala: k.kendala, solusi: k.solusi });
        });
      }
      setKendalaData(ksMap);

      // Finance per divisi (all time filtered)
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("divisi_id, tanggal, jenis_transaksi, nominal")
        .gte("tanggal", `${year}-${month}-01`)
        .lte("tanggal", `${year}-${month}-31`);
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
      <h1 className="text-2xl font-bold text-slate-900">Rekap & Kendala Solusi</h1>

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

      <Card>
        <CardHeader title="Rekap Keuangan per Divisi" />
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

      <Card>
        <CardHeader title="Rekap Kendala & Solusi Bulanan" subtitle={`${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`} />
        <CardContent>
          <div className="space-y-6">
            {divisiOptions
              .filter((d) => filterDivisi === "all" || d.id === filterDivisi)
              .map((d) => {
                const list = kendalaData[d.id] ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={d.id}>
                    <h3 className="mb-2 font-semibold text-slate-800">{d.nama}</h3>
                    <div className="space-y-2">
                      {list.map((ks, i) => (
                        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-400">Kendala</p>
                            <p className="text-sm">{ks.kendala}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Solusi</p>
                            <p className="text-sm">{ks.solusi}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            {divisiOptions
              .filter((d) => filterDivisi === "all" || d.id === filterDivisi)
              .every((d) => !kendalaData[d.id]?.length) && (
              <EmptyState title="Tidak ada kendala pada periode ini" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
