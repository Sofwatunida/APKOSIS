"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LaporanHarian, KendalaSolusi } from "@/lib/types";
import { formatDate, formatDateTime, todayISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { ExportMenu } from "@/components/export-menu";
import { Eye } from "lucide-react";

interface DivisiRow {
  id: string;
  nomor_divisi: number;
  nama_divisi: string;
}

/** Data minimal laporan untuk menghitung status & laporan terakhir. */
interface ReportBrief {
  id: string;
  divisi_id: string;
  tanggal: string;
  created_at: string;
}

interface TableRow {
  no: number;
  id: string;
  nama_divisi: string;
  sudah: boolean;
  last: ReportBrief | null;
}

/**
 * Rekap pengisian laporan harian per divisi untuk role monitoring &
 * sekretaris.
 *
 * Kolom: No | Nama Divisi | Status (Sudah/Belum Mengisi) | Laporan
 * Terakhir | tombol Lihat yang membuka card detail laporan.
 */
export function LaporanDivisiTable() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [divisiList, setDivisiList] = useState<DivisiRow[]>([]);
  const [briefs, setBriefs] = useState<ReportBrief[]>([]);

  const [filterTanggal, setFilterTanggal] = useState(todayISO());
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState<LaporanHarian | null>(null);
  const [kendalaDetail, setKendalaDetail] = useState<KendalaSolusi[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailDivisi, setDetailDivisi] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: div }, { data: reps }] = await Promise.all([
        supabase
          .from("divisi")
          .select("id, nomor_divisi, nama_divisi")
          .order("nomor_divisi"),
        supabase
          .from("laporan_harian")
          .select("id, divisi_id, tanggal, created_at")
          .order("tanggal", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      setDivisiList(div ?? []);
      setBriefs(reps ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo<TableRow[]>(() => {
    const lastByDiv = new Map<string, ReportBrief>();
    const onDateByDiv = new Set<string>();
    for (const b of briefs) {
      if (b.tanggal === filterTanggal) onDateByDiv.add(b.divisi_id);
      if (!lastByDiv.has(b.divisi_id)) lastByDiv.set(b.divisi_id, b);
    }

    const q = search.trim().toLowerCase();
    const filtered = divisiList.filter(
      (d) => !q || d.nama_divisi.toLowerCase().includes(q)
    );

    return filtered
      .map((d) => {
        const last = lastByDiv.get(d.id) ?? null;
        const sudah = onDateByDiv.has(d.id);
        return { no: 0, id: d.id, nama_divisi: d.nama_divisi, sudah, last } as TableRow;
      })
      .filter((r) =>
        filterStatus === "all"
          ? true
          : filterStatus === "sudah"
            ? r.sudah
            : !r.sudah
      )
      .map((r, idx) => ({ ...r, no: idx + 1 }));
  }, [briefs, divisiList, filterTanggal, filterStatus, search]);

  const sudahCount = rows.filter((r) => r.sudah).length;
  const belumCount = rows.length - sudahCount;

  async function openDetail(row: TableRow) {
    const last = row.last;
    if (!last) return;
    setDetailDivisi(row.nama_divisi);
    setLoadingDetail(true);
    setDetail(null);
    setKendalaDetail([]);
    const [{ data }, { data: ks }] = await Promise.all([
      supabase.from("laporan_harian").select("*").eq("id", last.id).maybeSingle(),
      supabase
        .from("kendala_solusi")
        .select("*")
        .eq("laporan_id", last.id)
        .order("created_at"),
    ]);
    setDetail(data ?? null);
    setKendalaDetail(ks ?? []);
    setLoadingDetail(false);
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Filter */}
      <Card>
        <CardHeader title="Filter" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Tanggal" hint="Status ditentukan dari laporan pada tanggal ini.">
              <Input
                type="date"
                value={filterTanggal}
                onChange={(e) => setFilterTanggal(e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">Semua</option>
                <option value="sudah">Sudah Mengisi</option>
                <option value="belum">Belum Mengisi</option>
              </Select>
            </Field>
            <Field label="Cari Divisi">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama divisi..."
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Tabel rekap per divisi */}
      <Card>
        <CardHeader
          title="Rekap Laporan Divisi"
          subtitle={`${formatDate(filterTanggal)} — ${sudahCount} sudah mengisi, ${belumCount} belum`}
          action={
            <ExportMenu
              title="Rekap Laporan Divisi"
              subtitle={`Per ${formatDate(filterTanggal)}`}
              filename="rekap-laporan-divisi"
              disabled={rows.length === 0}
              columns={[
                { header: "No", key: "no", width: 6 },
                { header: "Divisi", key: "divisi", width: 30 },
                { header: "Status", key: "status", width: 18 },
                { header: "Laporan Terakhir", key: "laporan_terakhir", width: 20 },
                { header: "Dibuat", key: "dibuat", width: 26 },
              ]}
              rows={rows.map((r) => ({
                no: r.no,
                divisi: r.nama_divisi,
                status: r.sudah ? "Sudah Mengisi" : "Belum Mengisi",
                laporan_terakhir: r.last ? formatDate(r.last.tanggal) : "-",
                dibuat: r.last ? formatDateTime(r.last.created_at) : "-",
              }))}
            />
          }
        />
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              title="Tidak ada divisi"
              description="Tidak ada divisi yang cocok dengan filter saat ini."
            />
          ) : (
            <div className="table-scroll">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    <th className="w-12 px-5 py-3.5 font-semibold">No</th>
                    <th className="px-5 py-3.5 font-semibold">Nama Divisi</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold">Laporan Terakhir</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/70">
                      <td className="px-5 py-3.5 text-xs text-slate-400">{r.no}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        {r.nama_divisi}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {r.sudah ? (
                          <Badge color="green">Sudah Mengisi</Badge>
                        ) : (
                          <Badge color="red">Belum Mengisi</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {r.last ? (
                          <>
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {formatDate(r.last.tanggal)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Dibuat {formatDateTime(r.last.created_at)}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!r.last}
                          onClick={() => openDetail(r)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          title={r.last ? "Lihat rincian laporan" : "Belum ada laporan"}
                        >
                          <Eye className="h-3 w-3 text-slate-400" />
                          <span>Lihat</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card detail laporan */}
      <Modal
        open={!!detail || loadingDetail}
        onClose={() => setDetail(null)}
        title={`Detail Laporan — ${detailDivisi || "Divisi"}`}
      >
        {loadingDetail ? (
          <div className="py-8 text-center text-xs text-slate-400">Memuat detail laporan...</div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tanggal Laporan</p>
                <p className="mt-0.5 font-bold text-slate-900 dark:text-white">{formatDate(detail.tanggal)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Penerima Laporan</p>
                <p className="mt-0.5 font-bold text-slate-900 dark:text-white">{detail.penerima_laporan || "-"}</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kegiatan Hari Ini</p>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {detail.kegiatan_hari_ini}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kendala & Solusi</p>
              {kendalaDetail.length > 0 ? (
                <div className="space-y-2.5">
                  {kendalaDetail.map((k) => (
                    <div key={k.id} className="space-y-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-900/60">
                      <p className="flex items-start gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                        <span className="shrink-0">⚠️</span>
                        <span>Kendala: <span className="font-normal text-slate-800 dark:text-slate-200">{k.kendala}</span></span>
                      </p>
                      <p className="flex items-start gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="shrink-0">💡</span>
                        <span>Solusi: <span className="font-normal text-slate-800 dark:text-slate-200">{k.solusi}</span></span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-3.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                  Tidak ada kendala yang dilaporkan.
                </p>
              )}
            </div>

            {detail.informasi_lain && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Informasi Lain</p>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {detail.informasi_lain}
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
              Dibuat {formatDateTime(detail.created_at)} · Terakhir diperbarui {formatDateTime(detail.updated_at)}
            </div>
          </div>
        ) : (
          <EmptyState title="Laporan tidak ditemukan" />
        )}
      </Modal>
    </div>
  );
}