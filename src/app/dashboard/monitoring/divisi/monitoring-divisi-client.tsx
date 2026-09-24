"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Divisi } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, todayISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/feedback";
import { ExportMenu } from "@/components/export-menu";

export function MonitoringDivisiClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [divisiList, setDivisiList] = useState<
    Array<Divisi & { anggota: number; todayReport: boolean; lastReportDate: string | null; kendala: string; pemasukan: number; pengeluaran: number }>
  >([]);

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase.from("divisi").select("*").order("nomor_divisi");
      const list = div ?? [];

      const today = todayISO();
      const { data: todayReports } = await supabase
        .from("laporan_harian")
        .select("id, divisi_id, tanggal")
        .eq("tanggal", today);
      const todaySet = new Set(todayReports?.map((r) => r.divisi_id) ?? []);

      const { data: allReports } = await supabase
        .from("laporan_harian")
        .select("id, divisi_id, tanggal, kegiatan_hari_ini")
        .order("tanggal", { ascending: false });

      // per division last report
      const lastByDiv = new Map<string, { tanggal: string; kegiatan: string }>();
      (allReports ?? []).forEach((r) => {
        if (!lastByDiv.has(r.divisi_id)) {
          lastByDiv.set(r.divisi_id, { tanggal: r.tanggal, kegiatan: r.kegiatan_hari_ini });
        }
      });

      const { data: anggota } = await supabase.from("anggota_divisi").select("divisi_id, id");
      const anggotaCount = new Map<string, number>();
      (anggota ?? []).forEach((a) => {
        anggotaCount.set(a.divisi_id, (anggotaCount.get(a.divisi_id) ?? 0) + 1);
      });

      const { data: kendala } = await supabase
        .from("kendala_solusi")
        .select("laporan_id, kendala")
        .order("created_at", { ascending: false });
      const laporanIdToDivisi = new Map<string, string>();
      (allReports ?? []).forEach((r) => laporanIdToDivisi.set(r.id, r.divisi_id));

      const kendalaLatest = new Map<string, string>();
      (kendala ?? []).forEach((k) => {
        const did = laporanIdToDivisi.get(k.laporan_id);
        if (did && !kendalaLatest.has(did)) kendalaLatest.set(did, k.kendala);
      });

      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("divisi_id, jenis_transaksi, nominal");
      const masuk = new Map<string, number>();
      const keluar = new Map<string, number>();
      (txs ?? []).forEach((t) => {
        const did = t.divisi_id;
        const n = Number(t.nominal) || 0;
        if (t.jenis_transaksi === "pemasukan")
          masuk.set(did, (masuk.get(did) ?? 0) + n);
        else keluar.set(did, (keluar.get(did) ?? 0) + n);
      });

      const enriched = list.map((d) => {
        const last = lastByDiv.get(d.id);
        return {
          ...d,
          anggota: anggotaCount.get(d.id) ?? 0,
          todayReport: todaySet.has(d.id),
          lastReportDate: last?.tanggal ?? null,
          kendala: kendalaLatest.get(d.id) ?? "",
          pemasukan: masuk.get(d.id) ?? 0,
          pengeluaran: keluar.get(d.id) ?? 0,
        };
      });

      setDivisiList(enriched);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Semua Divisi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pantau 20 divisi OSIS</p>
        </div>
        <ExportMenu
          title="Data Divisi"
          filename="data-divisi"
          disabled={divisiList.length === 0}
          columns={[
            { header: "Divisi", key: "divisi", width: 20 },
            { header: "Ketua", key: "ketua", width: 20 },
            { header: "Wakil", key: "wakil", width: 20 },
            { header: "Anggota", key: "anggota", width: 10 },
            { header: "Laporan Hari Ini", key: "laporan_hari_ini", width: 16 },
            { header: "Laporan Terakhir", key: "laporan_terakhir", width: 14 },
            { header: "Kendala Terbaru", key: "kendala", width: 30 },
            { header: "Saldo", key: "saldo", width: 20, align: "right" },
          ]}
          rows={divisiList.map((d) => ({
            divisi: d.nama_divisi,
            ketua: d.ketua_divisi ?? "-",
            wakil: d.wakil_divisi ?? "-",
            anggota: d.anggota,
            laporan_hari_ini: d.todayReport ? "Sudah Mengisi" : "Belum Mengisi",
            laporan_terakhir: d.lastReportDate ? formatDate(d.lastReportDate) : "-",
            kendala: d.kendala || "-",
            saldo: formatRupiah(d.pemasukan - d.pengeluaran),
          }))}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700">
              <th className="px-3 py-3">Divisi</th>
              <th className="px-3 py-3">Ketua</th>
              <th className="px-3 py-3">Wakil</th>
              <th className="px-3 py-3">Anggota</th>
              <th className="px-3 py-3">Laporan Hari Ini</th>
              <th className="px-3 py-3">Laporan Terakhir</th>
              <th className="px-3 py-3">Kendala Terbaru</th>
              <th className="px-3 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {divisiList.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{d.nama_divisi}</td>
                <td className="px-3 py-3">{d.ketua_divisi || "-"}</td>
                <td className="px-3 py-3">{d.wakil_divisi || "-"}</td>
                <td className="px-3 py-3">{d.anggota}</td>
                <td className="px-3 py-3">
                  {d.todayReport ? (
                    <Badge color="green">Sudah Mengisi</Badge>
                  ) : (
                    <Badge color="red">Belum Mengisi</Badge>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {d.lastReportDate ? formatDate(d.lastReportDate) : "-"}
                </td>
                <td className="px-3 py-3 max-w-[200px] truncate">{d.kendala || "-"}</td>
                <td className="px-3 py-3 text-right font-medium">
                  {formatRupiah(d.pemasukan - d.pengeluaran)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
