"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { MONTH_NAMES_ID, endOfMonthISO, formatDate, startOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { DivisiSummaryCard } from "@/components/divisi-summary-card";
import { FinanceSummary } from "@/components/finance-summary";
import { ExportMenu } from "@/components/export-menu";
import { DetailKeuanganClient } from "@/app/dashboard/detail-keuangan/detail-keuangan-client";
import {
  SEMUA_DIVISI_VALUE,
  buildDivisiOptions,
  formatDivisiLabel,
  getDivisiFilterLabel,
  isSemuaDivisi,
} from "@/lib/divisi-options";
import { fetchSaldoAwalBendahara, fetchSaldoAwalMap } from "@/lib/finance";
import { usePeriode } from "@/lib/periode-context";

export function RekapKeuanganClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { periodeId } = usePeriode();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [divisiSelect, setDivisiSelect] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState(SEMUA_DIVISI_VALUE);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(startOfMonthISO(currentYear, currentMonth));
  const [endDate, setEndDate] = useState(endOfMonthISO(currentYear, currentMonth));
  const [selectedDivisi, setSelectedDivisi] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedDivisi) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedDivisi]);

  const [financePerDivisi, setFinancePerDivisi] = useState<Record<string, { masuk: number; keluar: number }>>({});
  const [financeMonthly, setFinanceMonthly] = useState<{ masuk: number; keluar: number }>({ masuk: 0, keluar: 0 });
  const [saldoPerDivisi, setSaldoPerDivisi] = useState<Record<string, number>>({});
  const [saldoBendahara, setSaldoBendahara] = useState(0);
  const [allDivSaldo, setAllDivSaldo] = useState<Array<{ id: string; nama: string; saldoAwal: number; masuk: number; keluar: number }>>([]);

  useEffect(() => {
    async function init() {
      const { data: div } = await supabase
        .from("divisi")
        .select("id, nomor_divisi, nama_divisi")
        .order("nomor_divisi");
      setDivisiOptions(
        (div ?? []).map((d) => ({
          id: d.id,
          nama: formatDivisiLabel(d.nomor_divisi, d.nama_divisi),
        }))
      );
      setDivisiSelect(buildDivisiOptions(div));
    }
    init();
  }, []);

  useEffect(() => {
    setStartDate(startOfMonthISO(filterYear, filterMonth));
    setEndDate(endOfMonthISO(filterYear, filterMonth));
  }, [filterMonth, filterYear]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = startDate || startOfMonthISO(filterYear, filterMonth);
      const to = endDate || from;
      const [rangeStart, rangeEnd] = from <= to ? [from, to] : [to, from];

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
      const divList = (await supabase.from("divisi").select("id, nomor_divisi, nama_divisi").order("nomor_divisi")).data ?? [];
      const saldoMap = await fetchSaldoAwalMap(supabase);
      setSaldoBendahara(await fetchSaldoAwalBendahara(supabase));
      const saldoRecord: Record<string, number> = {};
      saldoMap.forEach((value, key) => {
        saldoRecord[key] = value;
      });
      setSaldoPerDivisi(saldoRecord);
      setAllDivSaldo(divList.map((d) => ({
        id: d.id,
        nama: formatDivisiLabel(d.nomor_divisi, d.nama_divisi),
        saldoAwal: saldoMap.get(d.id) ?? 0,
        masuk: allDivMap.get(d.id)?.masuk ?? 0,
        keluar: allDivMap.get(d.id)?.keluar ?? 0,
      })));

      // Finance per divisi (filtered month)
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("divisi_id, tanggal, jenis_transaksi, nominal")
        .gte("tanggal", rangeStart)
        .lte("tanggal", rangeEnd);
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
    // Muat ulang saat periode diganti supaya saldo awal tidak tertinggal
    // dari periode sebelumnya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterYear, startDate, endDate, periodeId]);

  if (loading) return <Spinner />;

  const totalSaldoAwalDivisi = allDivSaldo.reduce(
    (total, d) => total + d.saldoAwal,
    0
  );
  const totalSaldoAwal = saldoBendahara + totalSaldoAwalDivisi;

  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);
  const filterDivisiLabel = getDivisiFilterLabel(filterDivisi, divisiOptions);
  const from = startDate || startOfMonthISO(filterYear, filterMonth);
  const to = endDate || from;
  const [rangeStart, rangeEnd] = from <= to ? [from, to] : [to, from];
  const periodeLabel = `${formatDate(rangeStart)} - ${formatDate(rangeEnd)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Keuangan"
      />

      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <Field label="Dari Tanggal">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Sampai Tanggal">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Divisi">
              <Select value={filterDivisi} onChange={(e) => setFilterDivisi(e.target.value)}>
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

      <FinanceSummary
        title="Ringkasan Keuangan OSIS"
        divisiId={filterDivisi}
      />

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

      {/* Saldo Keseluruhan */}
      <Card>
        <CardHeader
          title="Saldo Keseluruhan Semua Divisi"
          action={
            profile.role === "sekretaris" ? (
              <ExportMenu
                title={`Rekap Keuangan per Divisi - ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`}
                subtitle={`Periode ${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear} - ${filterDivisiLabel}`}
                division={filterDivisiLabel}
                filename="rekap-keuangan-per-divisi"
                disabled={divisiOptions.length === 0}
                columns={[
                  { header: "Divisi", key: "divisi", width: 22 },
                  { header: "Saldo Awal", key: "saldoAwal", width: 18, align: "right" },
                  { header: "Pemasukan", key: "pemasukan", width: 18, align: "right" },
                  { header: "Pengeluaran", key: "pengeluaran", width: 18, align: "right" },
                  { header: "Saldo", key: "saldo", width: 18, align: "right" },
                ]}
                rows={divisiOptions
                  .filter((d) => isSemuaDivisi(filterDivisi) || d.id === filterDivisi)
                  .map((d) => {
                    const f = financePerDivisi[d.id] ?? { masuk: 0, keluar: 0 };
                    const saldoAwal = saldoPerDivisi[d.id] ?? 0;
                    return {
                      divisi: d.nama,
                      saldoAwal: formatRupiah(saldoAwal),
                      pemasukan: formatRupiah(f.masuk),
                      pengeluaran: formatRupiah(f.keluar),
                      saldo: formatRupiah(saldoAwal + f.masuk - f.keluar),
                    };
                  })}
              />
            ) : undefined
          }
        />
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-900/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Saldo Awal Bendahara (Kas Pusat)
              </p>
              <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-300">
                {formatRupiah(saldoBendahara)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Diatur role Bendahara pada menu Transaksi
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Saldo Awal
              </p>
              <p className="mt-1 text-xl font-bold text-brand-600 dark:text-brand-400">
                {formatRupiah(totalSaldoAwal)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Bendahara {formatRupiah(saldoBendahara)} + divisi{" "}
                {formatRupiah(totalSaldoAwalDivisi)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allDivSaldo
              .filter((d) => isSemuaDivisi(filterDivisi) || d.id === filterDivisi)
              .map((d) => (
                <DivisiSummaryCard
                  key={d.id}
                  divisi={{ id: d.id, nama: d.nama, saldoAwal: d.saldoAwal, masuk: d.masuk, keluar: d.keluar }}
                  periode="tahunan"
                  onSelect={setSelectedDivisi}
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
              .filter((d) => isSemuaDivisi(filterDivisi) || d.id === filterDivisi)
              .map((d) => {
                const f = financePerDivisi[d.id] ?? { masuk: 0, keluar: 0 };
                return (
                  <DivisiSummaryCard
                    key={d.id}
                    divisi={{
                      id: d.id,
                      nama: d.nama,
                      saldoAwal: saldoPerDivisi[d.id] ?? 0,
                      masuk: f.masuk,
                      keluar: f.keluar,
                    }}
                    periode="bulanan"
                    onSelect={setSelectedDivisi}
                  />
                );
              })}
          </div>
        </CardContent>
      </Card>

      {selectedDivisi && (
        <div id="detail-transaksi-divisi" ref={detailRef}>
          <DetailKeuanganClient
            key={selectedDivisi}
            profile={profile}
            initialDivisi={selectedDivisi}
            initialPeriode="bulanan"
            embedded
            historyMode
            onBack={() => setSelectedDivisi(null)}
          />
        </div>
      )}
    </div>
  );
}