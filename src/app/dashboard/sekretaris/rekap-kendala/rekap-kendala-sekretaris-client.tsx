"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { ExportMenu } from "@/components/export-menu";
import { createClient } from "@/lib/supabase/client";
import { MONTH_NAMES_ID, endOfMonthISO, formatDate, startOfMonthISO } from "@/lib/date";
import {
  SEMUA_DIVISI_LABEL,
  formatDivisiLabel,
  isSemuaDivisi,
} from "@/lib/divisi-options";
import {
  REKAP_KENDALA_COLUMNS,
  RekapKendalaList,
  buildRekapKendalaRows,
  type RekapKendalaItem,
} from "@/components/rekap-kendala-list";

export interface DivisiRekapOpsi {
  id: string;
  nomorDivisi: number | null;
  namaDivisi: string;
}

interface RekapKendalaSekretarisClientProps {
  divisi: DivisiRekapOpsi[];
  selected: DivisiRekapOpsi | null;
}

interface KendalaItem {
  id: string;
  tanggal: string;
  kendala: string;
  solusi: string;
  divisiId?: string;
  divisiLabel?: string;
}

const BASE_PATH = "/dashboard/sekretaris/rekap-kendala";
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function nomorLabel(nomor: number | null): string {
  return typeof nomor === "number" ? String(nomor).padStart(2, "0") : "-";
}

function DivisiSelector({ divisi }: { divisi: DivisiRekapOpsi[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Kendala Divisi"
      />

      <Card>
        <CardHeader title="Daftar Divisi" />
        <CardContent>
          {divisi.length === 0 ? (
            <EmptyState title="Belum ada data divisi." />
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
              {divisi.map((d) => (
                <Link
                  key={d.id}
                  href={`${BASE_PATH}?divisi=${encodeURIComponent(d.id)}`}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-brand-500 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-slate-950"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isSemuaDivisi(d.id)
                      ? SEMUA_DIVISI_LABEL
                      : formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-500 dark:text-slate-600 dark:group-hover:text-brand-400" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RekapKendalaDetail({
  divisi,
  divisiList,
}: {
  divisi: DivisiRekapOpsi;
  divisiList: DivisiRekapOpsi[];
}) {
  const router = useRouter();
  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH);
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [startDate, setStartDate] = useState(startOfMonthISO(CURRENT_YEAR, CURRENT_MONTH));
  const [endDate, setEndDate] = useState(endOfMonthISO(CURRENT_YEAR, CURRENT_MONTH));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [kendala, setKendala] = useState<KendalaItem[]>([]);
  const yearOptions = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

  const semuaDivisi = isSemuaDivisi(divisi.id);
  const namaDivisi = semuaDivisi
    ? SEMUA_DIVISI_LABEL
    : formatDivisiLabel(divisi.nomorDivisi, divisi.namaDivisi);
  const nomorDivisi = semuaDivisi ? "ALL" : nomorLabel(divisi.nomorDivisi);

  useEffect(() => {
    setStartDate(startOfMonthISO(filterYear, filterMonth));
    setEndDate(endOfMonthISO(filterYear, filterMonth));
  }, [filterMonth, filterYear]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const supabase = createClient();
      const from = startDate || startOfMonthISO(filterYear, filterMonth);
      const to = endDate || from;
      const [rangeStart, rangeEnd] = from <= to ? [from, to] : [to, from];
      let query = supabase
        .from("laporan_harian")
        .select("id, tanggal, divisi_id")
        .gte("tanggal", rangeStart)
        .lte("tanggal", rangeEnd)
        .order("tanggal", { ascending: false });
      if (!semuaDivisi) query = query.eq("divisi_id", divisi.id);

      const { data: reports } = await query;

      const reportList = reports ?? [];
      const reportIds = reportList.map((r) => r.id);
      const tanggalByReport = new Map(reportList.map((r) => [r.id, r.tanggal]));
      const divisiById = new Map(
        divisiList.map((d) => [
          d.id,
          isSemuaDivisi(d.id)
            ? SEMUA_DIVISI_LABEL
            : formatDivisiLabel(d.nomorDivisi, d.namaDivisi),
        ])
      );
      let next: KendalaItem[] = [];

      if (reportIds.length > 0) {
        const { data: kendalaRows } = await supabase
          .from("kendala_solusi")
          .select("id, laporan_id, kendala, solusi")
          .in("laporan_id", reportIds)
          .order("created_at", { ascending: false });

        next = (kendalaRows ?? []).flatMap((row) => {
          const tanggal = tanggalByReport.get(row.laporan_id);
          if (!tanggal) return [];
          const report = reportList.find((r) => r.id === row.laporan_id);
          const divisiId = (report as { divisi_id?: string } | undefined)?.divisi_id;
          return [
            {
              id: row.id,
              tanggal,
              kendala: row.kendala,
              solusi: row.solusi,
              ...(semuaDivisi && divisiId
                ? { divisiId, divisiLabel: divisiById.get(divisiId) ?? divisiId }
                : {}),
            },
          ];
        });
      }

      if (active) {
        setKendala(next);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [divisi.id, divisiList, semuaDivisi, startDate, endDate, filterMonth, filterYear]);

  const query = search.trim().toLowerCase();
  const filteredKendala = useMemo(() => {
    if (!query) return kendala;
    return kendala.filter(
      (item) =>
        (item.kendala ?? "").toLowerCase().includes(query) ||
        (item.solusi ?? "").toLowerCase().includes(query) ||
        (item.divisiLabel ?? "").toLowerCase().includes(query) ||
        item.tanggal.includes(query)
    );
  }, [kendala, query]);

  const displayItems = useMemo<RekapKendalaItem[]>(
    () =>
      filteredKendala.map((item) => ({
        id: item.id,
        tanggal: item.tanggal,
        divisi: semuaDivisi ? item.divisiLabel ?? "-" : namaDivisi,
        kendala: item.kendala,
        solusi: item.solusi,
      })),
    [filteredKendala, semuaDivisi, namaDivisi]
  );

  const exportRows = useMemo(
    () => buildRekapKendalaRows(displayItems),
    [displayItems]
  );
  const from = startDate || startOfMonthISO(CURRENT_YEAR, CURRENT_MONTH);
  const to = endDate || from;
  const [rangeStart, rangeEnd] = from <= to ? [from, to] : [to, from];
  const periodeLabel = `${formatDate(rangeStart)} - ${formatDate(rangeEnd)}`;

  function handleBack() {
    router.push(BASE_PATH);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Rekap Kendala – ${namaDivisi}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900 dark:text-white">
            {namaDivisi}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali
        </Button>
      </div>

      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Bulan">
              <Select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
                {MONTH_NAMES_ID.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tahun">
              <Select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </Field>
            <Field label="Dari Tanggal">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Sampai Tanggal">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Pencarian">
              <Input
                placeholder="Cari kendala, solusi, divisi, atau tanggal (YYYY-MM-DD)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
              subtitle={`${periodeLabel} - ${namaDivisi}`}
              filename={`rekap-kendala-${semuaDivisi ? "semua-divisi" : `divisi-${nomorDivisi}`}`}
              division={namaDivisi}
              disabled={exportRows.length === 0}
              columns={REKAP_KENDALA_COLUMNS}
              rows={exportRows}
            />
          }
        />
        <CardContent>
          {loading ? (
            <Spinner />
          ) : (
            <RekapKendalaList
              items={displayItems}
              emptyTitle="Tidak ada kendala pada periode ini"
              emptyDescription="Ubah rentang tanggal atau kata kunci pencarian untuk melihat data lain."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function RekapKendalaSekretarisClient({
  divisi,
  selected,
}: RekapKendalaSekretarisClientProps) {
  if (!selected) return <DivisiSelector divisi={divisi} />;
  return (
    <RekapKendalaDetail
      key={selected.id}
      divisi={selected}
      divisiList={divisi}
    />
  );
}
