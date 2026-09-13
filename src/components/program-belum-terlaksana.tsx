"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

interface DivisiNote {
  id: string;
  nomor_divisi: number;
  nama_divisi: string;
  catatan?: string | null;
}

const EMPTY_NOTE = "Tidak ada catatan program yang belum terlaksana.";

export function CatatanProgramBelumTerlaksana({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [divisiList, setDivisiList] = useState<DivisiNote[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<DivisiNote | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("divisi")
      .select("id, nomor_divisi, nama_divisi, catatan_program_belum_terlaksana")
      .order("nomor_divisi");
    const list = (data ?? []).map((d) => ({
      id: d.id,
      nomor_divisi: d.nomor_divisi,
      nama_divisi: d.nama_divisi,
      catatan: d.catatan_program_belum_terlaksana,
    }));
    setDivisiList(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return divisiList;
    return divisiList.filter((d) =>
      d.nama_divisi.toLowerCase().includes(q)
    );
  }, [divisiList, search]);

  async function handleExport() {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Program Belum Terlaksana");
      ws.columns = [
        { header: "No", key: "no", width: 6 },
        { header: "Nama Divisi", key: "divisi", width: 28 },
        { header: "Program Belum Terlaksana", key: "catatan", width: 60 },
      ];
      divisiList.forEach((d, idx) => {
        ws.addRow({
          no: idx + 1,
          divisi: d.nama_divisi,
          catatan: d.catatan?.trim() || EMPTY_NOTE,
        });
      });
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F46E5" } };
        cell.alignment = { vertical: "middle" };
      });
      headerRow.height = 22;
      ws.views = [{ state: "frozen", ySplit: 1 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rekapitulasi-program-belum-terlaksana.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      success("Dokumen rekapitulasi berhasil diunduh.");
    } catch {
      error("Gagal membuat dokumen export.");
    }
    setExporting(false);
  }

  if (loading) return <Spinner />;

  return (
    <Card>
      <CardHeader
        title="Catatan Program Belum Terlaksana"
        subtitle="Program kerja yang belum dilaksanakan per divisi"
        action={
          profile.role === "sekretaris" ? (
            <Button onClick={handleExport} loading={exporting} variant="outline" size="sm">
              {exporting ? "Membuat..." : "Export Dokumen"}
            </Button>
          ) : undefined
        }
      />
      <CardContent>
        <div className="mb-4 w-full sm:w-80">
          <Input
            placeholder="Cari berdasarkan nama divisi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title={search ? "Divisi tidak ditemukan" : "Belum ada divisi"}
            description={search ? "Coba kata kunci pencarian yang lain." : "Data divisi belum tersedia."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Divisi</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, idx) => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{d.nama_divisi}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setView(d)}
                        className="rounded-lg border border-brand-500 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-100"
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Modal
        open={Boolean(view)}
        onClose={() => setView(null)}
        title={`Program Belum Terlaksana - ${view?.nama_divisi ?? ""}`}
      >
        {view && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Nomor Divisi</p>
                <p className="font-semibold text-slate-800">{view.nomor_divisi}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Nama Divisi</p>
                <p className="font-semibold text-slate-800">{view.nama_divisi}</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {view.catatan?.trim() ? view.catatan : <span className="text-slate-400">{EMPTY_NOTE}</span>}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setView(null)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}