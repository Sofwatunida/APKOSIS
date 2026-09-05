"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LaporanHarian, KendalaSolusi } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";

export interface DivisiOption {
  id: string;
  nama_divisi: string;
}

interface LaporanDetail extends LaporanHarian {
  divisi: { nama_divisi: string } | null;
}

export function LaporanListView({
  divisiId,
}: {
  divisiId?: string;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [divisiOptions, setDivisiOptions] = useState<DivisiOption[]>([]);
  const [filterDivisi, setFilterDivisi] = useState(divisiId ?? "all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [laporan, setLaporan] = useState<LaporanDetail[]>([]);
  const [detail, setDetail] = useState<LaporanDetail | null>(null);
  const [kendalaDetail, setKendalaDetail] = useState<KendalaSolusi[]>([]);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("laporan_harian")
      .select("*, divisi(nama_divisi)")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterDivisi !== "all") query = query.eq("divisi_id", filterDivisi);
    if (filterTanggal) query = query.eq("tanggal", filterTanggal);
    if (search) query = query.ilike("kegiatan_hari_ini", `%${search}%`);

    const { data } = await query;
    let list = (data ?? []) as LaporanDetail[];

    if (filterStatus !== "all") {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter((l) => {
        const isToday = l.tanggal === today;
        return filterStatus === "sudah" ? isToday : !isToday;
      });
    }

    setLaporan(list);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const { data: div } = await supabase
        .from("divisi")
        .select("id, nama_divisi")
        .order("nomor_divisi");
      setDivisiOptions(div ?? []);
    }
    init();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDivisi, filterTanggal, search]);

  async function openDetail(l: LaporanDetail) {
    setDetail(l);
    const { data: ks } = await supabase
      .from("kendala_solusi")
      .select("*")
      .eq("laporan_id", l.id)
      .order("created_at");
    setKendalaDetail(ks ?? []);
  }

  if (loading && laporan.length === 0) return <Spinner />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Filter Laporan" />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Divisi">
              <Select value={filterDivisi} onChange={(e) => setFilterDivisi(e.target.value)}>
                <option value="all">Semua Divisi</option>
                {divisiOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama_divisi}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tanggal">
              <Input type="date" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">Semua</option>
                <option value="sudah">Sudah Mengisi</option>
                <option value="belum">Belum Mengisi</option>
              </Select>
            </Field>
            <Field label="Cari Kegiatan">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kegiatan..."
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Daftar Laporan" />
        <CardContent>
          {laporan.length === 0 ? (
            <EmptyState title="Tidak ada laporan" description="Atur filter untuk melihat laporan." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Divisi</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Kegiatan</th>
                    <th className="px-3 py-2">Penerima</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {laporan.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-medium">{l.divisi?.nama_divisi ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.tanggal)}</td>
                      <td className="px-3 py-2 max-w-md truncate">{l.kegiatan_hari_ini}</td>
                      <td className="px-3 py-2">{l.penerima_laporan || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => openDetail(l)} className="text-brand-600 hover:underline">
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
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detail Laporan">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Divisi</p>
                <p className="font-medium">{detail.divisi?.nama_divisi ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tanggal</p>
                <p className="font-medium">{formatDate(detail.tanggal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Penerima</p>
                <p className="font-medium">{detail.penerima_laporan || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Dibuat</p>
                <p className="font-medium">{formatDateTime(detail.created_at)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Kegiatan Hari Ini</p>
              <p className="whitespace-pre-wrap text-sm">{detail.kegiatan_hari_ini}</p>
            </div>
            {kendalaDetail.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-400">Kendala & Solusi</p>
                <div className="space-y-2">
                  {kendalaDetail.map((k) => (
                    <div key={k.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p><span className="font-medium">Kendala:</span> {k.kendala}</p>
                      <p className="mt-1"><span className="font-medium">Solusi:</span> {k.solusi}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Tidak ada kendala.</p>
            )}
            {detail.informasi_lain && (
              <div>
                <p className="text-xs text-slate-400">Informasi Lain</p>
                <p className="whitespace-pre-wrap text-sm">{detail.informasi_lain}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400">Terakhir Diperbarui</p>
              <p className="text-sm">{formatDateTime(detail.updated_at)}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
