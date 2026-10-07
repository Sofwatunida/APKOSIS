"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { DivisiSummaryCard } from "@/components/divisi-summary-card";
import { FinanceSummary } from "@/components/finance-summary";
import { ExportMenu } from "@/components/export-menu";
import { buildDivisiOptions } from "@/lib/divisi-options";
import { Eye } from "lucide-react";

export function RekapKeuanganClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  // Khusus dropdown divisi: selalu lengkap "Divisi 01" .. "Divisi 20".
  const [divisiSelect, setDivisiSelect] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState("all");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  const [financePerDivisi, setFinancePerDivisi] = useState<Record<string, { masuk: number; keluar: number }>>({});
  const [financeMonthly, setFinanceMonthly] = useState<{ masuk: number; keluar: number }>({ masuk: 0, keluar: 0 });
  const [allDivSaldo, setAllDivSaldo] = useState<Array<{ id: string; nama: string; masuk: number; keluar: number }>>([]);

  useEffect(() => {
    async function init() {
      const { data: div } = await supabase
        .from("divisi")
        .select("id, nomor_divisi, nama_divisi")
        .order("nomor_divisi");
      setDivisiOptions((div ?? []).map((d) => ({ id: d.id, nama: d.nama_divisi })));
      setDivisiSelect(buildDivisiOptions(div));
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
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rekap Keuangan</h1>

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
                {divisiSelect.map((d) => (
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
              .map((d) => (
                <DivisiSummaryCard
                  key={d.id}
                  divisi={{ id: d.id, nama: d.nama, masuk: d.masuk, keluar: d.keluar }}
                  periode="tahunan"
                />
              ))}
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
                  <DivisiSummaryCard
                    key={d.id}
                    divisi={{ id: d.id, nama: d.nama, masuk: f.masuk, keluar: f.keluar }}
                    periode="bulanan"
                  />
                );
              })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pemasukan {MONTH_NAMES_ID[filterMonth - 1]}</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(financeMonthly.masuk)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pengeluaran {MONTH_NAMES_ID[filterMonth - 1]}</p>
            <p className="text-2xl font-bold text-red-600">{formatRupiah(financeMonthly.keluar)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rekap Keuangan per Divisi + Export Button */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Rekap Keuangan per Divisi</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{MONTH_NAMES_ID[filterMonth - 1]} {filterYear}</p>
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
              {divisiOptions
                .filter((d) => filterDivisi === "all" || d.id === filterDivisi)
                .map((d) => {
                  const f = financePerDivisi[d.id] ?? { masuk: 0, keluar: 0 };
                  const saldo = f.masuk - f.keluar;
                  return (
                    <TR key={d.id}>
                      <TD className="min-w-[9rem] whitespace-nowrap font-medium">
                        {d.nama}
                      </TD>
                      <TD align="right" className="whitespace-nowrap">
                        {formatRupiah(f.masuk)}
                      </TD>
                      <TD align="right" className="whitespace-nowrap">
                        {formatRupiah(f.keluar)}
                      </TD>
                      <TD
                        align="right"
                        className={`whitespace-nowrap font-medium ${
                          saldo >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600"
                        }`}
                      >
                        {formatRupiah(saldo)}
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
                  );
                })}
            </TBody>
          </TableWrap>
        </CardContent>
      </Card>
    </div>
  );
}