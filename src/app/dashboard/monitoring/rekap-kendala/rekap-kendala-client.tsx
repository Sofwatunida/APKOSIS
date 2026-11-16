"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { MONTH_NAMES_ID, endOfMonthISO, formatDateShort } from "@/lib/date";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { ExportMenu } from "@/components/export-menu";

interface KendalaWithDate {
  kendala: string;
  solusi: string;
  tanggal: string;
}

export function RekapKendalaClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama: string }[]>([]);
  const [filterDivisi, setFilterDivisi] = useState("all");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [searchKendala, setSearchKendala] = useState("");

  const [kendalaData, setKendalaData] = useState<Record<string, KendalaWithDate[]>>({});

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

      // Fetch reports for kendala
      const { data: reports } = await supabase
        .from("laporan_harian")
        .select("id, divisi_id, tanggal")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate);
      const reportsList = reports ?? [];
      const reportIds = reportsList.map((r) => r.id);

      const ksMap: Record<string, KendalaWithDate[]> = {};
      if (reportIds.length > 0) {
        const { data: ks } = await supabase
          .from("kendala_solusi")
          .select("laporan_id, kendala, solusi");
        const laporanToDivisi = new Map(reportsList.map((r) => [r.id, { divisi_id: r.divisi_id, tanggal: r.tanggal }]));
        (ks ?? []).forEach((k) => {
          const info = laporanToDivisi.get(k.laporan_id);
          if (!info) return;
          if (!ksMap[info.divisi_id]) ksMap[info.divisi_id] = [];
          ksMap[info.divisi_id].push({ kendala: k.kendala, solusi: k.solusi, tanggal: info.tanggal });
        });
      }
      setKendalaData(ksMap);
      setLoading(false);
    }
    load();
  }, [filterMonth, filterYear]);

  // Filter kendala by search
  const filteredKendalaData: Record<string, KendalaWithDate[]> = {};
  Object.entries(kendalaData).forEach(([divId, list]) => {
    if (filterDivisi !== "all" && divId !== filterDivisi) return;
    const filtered = list.filter((ks) => {
      if (!searchKendala.trim()) return true;
      const q = searchKendala.toLowerCase();
      return ks.kendala.toLowerCase().includes(q) || ks.tanggal.includes(q);
    });
    if (filtered.length > 0) filteredKendalaData[divId] = filtered;
  });

  // Detail data (datar) untuk ekspor rekap detail
  const flatDetail: {
    no: number;
    divisi: string;
    tanggal: string;
    kendala: string;
    solusi: string;
  }[] = [];
  Object.entries(filteredKendalaData).forEach(([divId, list]) => {
    const divName = divisiOptions.find((d) => d.id === divId)?.nama ?? divId;
    list.forEach((ks) => {
      flatDetail.push({
        no: flatDetail.length + 1,
        divisi: divName,
        tanggal: ks.tanggal,
        kendala: ks.kendala,
        solusi: ks.solusi,
      });
    });
  });

  if (loading) return <Spinner />;

  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Kendala"
        description="Daftar kendala dan solusi seluruh divisi dalam bentuk list ringkas."
      />

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

      {/* Rekap Kendala & Solusi Bulanan */}
      <Card>
        <CardHeader
          title="Rekap Kendala & Solusi Bulanan"
          subtitle={`${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`}
          action={
            <ExportMenu
              title="Rekap Kendala & Solusi"
              subtitle={`${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear} - Seluruh Divisi`}
              filename="rekap-kendala-solusi"
              disabled={flatDetail.length === 0}
              columns={[
                { header: "No", key: "no", width: 6 },
                { header: "Divisi", key: "divisi", width: 20 },
                { header: "Tanggal", key: "tanggal", width: 14 },
                { header: "Kendala", key: "kendala", width: 30 },
                { header: "Solusi", key: "solusi", width: 30 },
              ]}
              rows={flatDetail}
            />
          }
        />
        <CardContent>
          {/* Search filter for kendala */}
          <div className="mb-4">
            <Input
              placeholder="Cari berdasarkan kendala atau tanggal (YYYY-MM-DD)..."
              value={searchKendala}
              onChange={(e) => setSearchKendala(e.target.value)}
            />
          </div>
          <div className="space-y-5">
            {Object.entries(filteredKendalaData).length > 0 ? (
              Object.entries(filteredKendalaData).map(([divId, list]) => {
                const divName = divisiOptions.find((d) => d.id === divId)?.nama ?? divId;
                return (
                  <div
                    key={divId}
                    className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-4 py-2.5 dark:border-slate-800/80 dark:bg-slate-800/40">
                      <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {divName}
                      </h3>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {list.length} kendala
                      </span>
                    </div>
                    <div>
                      {list.map((ks, i) => (
                        <div key={i} className="list-row">
                          <span className="shrink-0 self-start rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 sm:w-24 sm:self-center sm:text-center dark:bg-slate-800 dark:text-slate-400">
                            {formatDateShort(ks.tanggal)}
                          </span>
                          <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-4">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:hidden dark:text-slate-500">
                                Kendala
                              </p>
                              <p className="break-words text-sm text-slate-700 dark:text-slate-200">
                                {ks.kendala || "-"}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:hidden dark:text-slate-500">
                                Solusi
                              </p>
                              <p className="break-words text-sm text-slate-600 dark:text-slate-300">
                                {ks.solusi || "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState title="Tidak ada kendala pada periode ini" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}