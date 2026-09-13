"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FinanceSummary } from "@/components/finance-summary";

export function RekapKeuanganClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState("all");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [exporting, setExporting] = useState(false);

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

  async function handleExportBulanan() {
    setExporting(true);
    try {
      const year = String(filterYear);
      const month = String(filterMonth).padStart(2, "0");
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("*, divisi(nama_divisi)")
        .gte("tanggal", `${year}-${month}-01`)
        .lte("tanggal", endOfMonthISO(filterYear, filterMonth))
        .order("tanggal", { ascending: true });

      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Rekap Keuangan Bulanan");
      ws.columns = [
        { header: "Tanggal", key: "tanggal", width: 14 },
        { header: "Divisi", key: "divisi", width: 24 },
        { header: "Jenis", key: "jenis", width: 14 },
        { header: "Keterangan", key: "keterangan", width: 35 },
        { header: "Nominal", key: "nominal", width: 20 },
      ];
      (txs ?? []).forEach((t: any) => {
        ws.addRow({
          tanggal: t.tanggal,
          divisi: t.divisi?.nama_divisi ?? "-",
          jenis: t.jenis_transaksi,
          keterangan: t.keterangan?.replace(/\[BUKTI:[^\]]+\]/, "").trim() ?? "",
          nominal: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(t.nominal) || 0),
        });
      });
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F46E5" } };
      });
      headerRow.height = 22;
      ws.views = [{ state: "frozen", ySplit: 1 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap-keuangan-${year}-${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      success("Export Excel bulanan berhasil diunduh.");
    } catch {
      error("Gagal membuat export.");
    }
    setExporting(false);
  }

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
            <Button onClick={handleExportBulanan} loading={exporting} variant="outline">
              {exporting ? "Membuat..." : "Export Excel Bulan Ini"}
            </Button>
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