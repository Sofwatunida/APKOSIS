"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { MONTH_NAMES_ID, endOfMonthISO } from "@/lib/date";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { ExportMenu } from "@/components/export-menu";
import {
  REKAP_KENDALA_COLUMNS,
  RekapKendalaList,
  buildRekapKendalaRows,
  type RekapKendalaItem,
} from "@/components/rekap-kendala-list";
import {
  SEMUA_DIVISI_VALUE,
  buildDivisiOptions,
  getDivisiFilterLabel,
  isSemuaDivisi,
} from "@/lib/divisi-options";

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
  const [filterDivisi, setFilterDivisi] = useState(SEMUA_DIVISI_VALUE);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [searchKendala, setSearchKendala] = useState("");

  const [kendalaData, setKendalaData] = useState<Record<string, KendalaWithDate[]>>({});

  useEffect(() => {
    async function init() {
      const { data: div } = await supabase
        .from("divisi")
        .select("id, nomor_divisi, nama_divisi")
        .order("nomor_divisi");
      setDivisiOptions(
        buildDivisiOptions(div).map((d) => ({ id: d.id, nama: d.nama }))
      );
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
    if (!isSemuaDivisi(filterDivisi) && divId !== filterDivisi) return;
    const filtered = list.filter((ks) => {
      if (!searchKendala.trim()) return true;
      const q = searchKendala.toLowerCase();
      return (
        (ks.kendala ?? "").toLowerCase().includes(q) ||
        (ks.solusi ?? "").toLowerCase().includes(q) ||
        ks.tanggal.includes(q)
      );
    });
    if (filtered.length > 0) filteredKendalaData[divId] = filtered;
  });

  const flatItems: RekapKendalaItem[] = [];
  Object.entries(filteredKendalaData).forEach(([divId, list]) => {
    const divName = divisiOptions.find((d) => d.id === divId)?.nama ?? divId;
    list.forEach((ks, index) => {
      flatItems.push({
        id: `${divId}-${ks.tanggal}-${index}`,
        tanggal: ks.tanggal,
        divisi: divName,
        kendala: ks.kendala,
        solusi: ks.solusi,
      });
    });
  });
  const exportRows = buildRekapKendalaRows(flatItems);

  if (loading) return <Spinner />;

  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - i);
  const filterDivisiLabel = getDivisiFilterLabel(filterDivisi, divisiOptions);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Kendala & Solusi"
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

      <Card>
        <CardHeader
          title="Data Kendala"
          action={
            <ExportMenu
              title="Rekap Kendala & Solusi"
              subtitle={`${MONTH_NAMES_ID[filterMonth - 1]} ${filterYear} - ${filterDivisiLabel}`}
              division={filterDivisiLabel}
              filename="rekap-kendala-solusi"
              disabled={exportRows.length === 0}
              columns={REKAP_KENDALA_COLUMNS}
              rows={exportRows}
            />
          }
        />
        <CardContent>
          {/* Search filter for kendala */}
          <div className="mb-4">
            <Input
              placeholder="Cari kendala, solusi, divisi, atau tanggal (YYYY-MM-DD)..."
              value={searchKendala}
              onChange={(e) => setSearchKendala(e.target.value)}
            />
          </div>
          <RekapKendalaList
            items={flatItems}
            emptyTitle="Tidak ada kendala pada periode ini"
            emptyDescription="Ubah bulan, tahun, divisi, atau kata kunci pencarian untuk melihat data lain."
          />
        </CardContent>
      </Card>
    </div>
  );
}