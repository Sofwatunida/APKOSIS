"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

  // Ringkasan / kesimpulan semua kendala (list unik + jumlah + divisi)
  const summaryMap = new Map<
    string,
    { kendala: string; count: number; divisis: string[] }
  >();
  Object.entries(filteredKendalaData).forEach(([divId, list]) => {
    const divName = divisiOptions.find((d) => d.id === divId)?.nama ?? divId;
    list.forEach((ks) => {
      const key = ks.kendala.trim().toLowerCase();
      if (!key) return;
      const cur = summaryMap.get(key) ?? {
        kendala: ks.kendala.trim(),
        count: 0,
        divisis: [],
      };
      cur.count += 1;
      if (!cur.divisis.includes(divName)) cur.divisis.push(divName);
      summaryMap.set(key, cur);
    });
  });
  const summaryList = [...summaryMap.values()].sort(
    (a, b) => b.count - a.count || a.kendala.localeCompare(b.kendala)
  );

  if (loading) return <Spinner />;

  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Rekap Kendala</h1>

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
          <div className="space-y-6">
            {Object.entries(filteredKendalaData).length > 0 ? (
              Object.entries(filteredKendalaData).map(([divId, list]) => {
                const divName = divisiOptions.find((d) => d.id === divId)?.nama ?? divId;
                return (
                  <div key={divId}>
                    <h3 className="mb-2 font-semibold text-slate-800">{divName}</h3>
                    <div className="space-y-2">
                      {list.map((ks, i) => (
                        <div key={i} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{ks.tanggal}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-slate-400">Kendala</p>
                              <p className="text-sm">{ks.kendala}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Solusi</p>
                              <p className="text-sm">{ks.solusi}</p>
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

      {/* Ringkasan / Kesimpulan Kendala */}
      <Card>
        <CardHeader
          title="Ringkasan Kendala (Kesimpulan)"
          subtitle="Daftar kesimpulan semua kendala pada periode terpilih"
          action={
            <ExportMenu
              title="Ringkasan Kendala"
              subtitle={`${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear} - Kesimpulan Seluruh Divisi`}
              filename="ringkasan-kendala"
              disabled={summaryList.length === 0}
              columns={[
                { header: "No", key: "no", width: 6 },
                { header: "Kendala", key: "kendala", width: 50 },
                { header: "Jumlah", key: "jumlah", width: 12, align: "right" },
                { header: "Divisi", key: "divisi", width: 28 },
              ]}
              rows={summaryList.map((s, idx) => ({
                no: idx + 1,
                kendala: s.kendala,
                jumlah: s.count,
                divisi: s.divisis.join(", "),
              }))}
            />
          }
        />
        <CardContent>
          {summaryList.length === 0 ? (
            <EmptyState title="Belum ada ringkasan" description="Tidak ada kendala yang tercatat pada periode ini." />
          ) : (
            <ol className="space-y-2">
              {summaryList.map((s, idx) => (
                <li
                  key={idx}
                  className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-start sm:gap-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{s.kendala}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Divisi: <span className="text-slate-500">{s.divisis.join(", ")}</span>
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {s.count} laporan
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}