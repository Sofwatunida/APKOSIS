"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";

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
        <CardHeader title="Rekap Kendala & Solusi Bulanan" subtitle={`${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear}`} />
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
    </div>
  );
}