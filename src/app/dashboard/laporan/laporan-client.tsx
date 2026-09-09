"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, LaporanHarian, KendalaSolusi } from "@/lib/types";
import { formatDate, todayISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, Select, Label } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

interface KendalaRow {
  kendala: string;
  solusi: string;
}

const emptyForm = {
  tanggal: todayISO(),
  pelapor_id: "",
  kegiatan_hari_ini: "",
  informasi_lain: "",
  penerima_laporan: "",
};

export function LaporanHarianClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [reportToday, setReportToday] = useState<LaporanHarian | null>(null);
  const [history, setHistory] = useState<LaporanHarian[]>([]);
  const [pelaporOptions, setPelaporOptions] = useState<{ id: string; nama: string }[]>([]);
  const [searchHistory, setSearchHistory] = useState("");

  // form state - starts empty
  const [form, setForm] = useState(emptyForm);
  const [kendalaRows, setKendalaRows] = useState<KendalaRow[]>([]);
  const [editingReport, setEditingReport] = useState<LaporanHarian | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // detail modal state
  const [detailReport, setDetailReport] = useState<LaporanHarian | null>(null);
  const [detailKendala, setDetailKendala] = useState<KendalaSolusi[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }

    // 1. Fetch History
    const { data: reports } = await supabase
      .from("laporan_harian")
      .select("*")
      .eq("divisi_id", profile.divisi_id)
      .order("tanggal", { ascending: false })
      .limit(100);
    setHistory(reports ?? []);

    // 2. Fetch Divisi to get ONLY Ketua & Wakil (Requirement 2)
    const { data: divData } = await supabase
      .from("divisi")
      .select("ketua_divisi, wakil_divisi")
      .eq("id", profile.divisi_id)
      .single();

    const { data: existingAnggota } = await supabase
      .from("anggota_divisi")
      .select("id, nama, jabatan")
      .eq("divisi_id", profile.divisi_id);

    const options: { id: string; nama: string }[] = [];
    const ketuaName = divData?.ketua_divisi?.trim() || "";
    const wakilName = divData?.wakil_divisi?.trim() || "";

    // Match or ensure Ketua in anggota_divisi so foreign key is satisfied
    let ketuaAnggota = (existingAnggota ?? []).find(
      (a) => a.jabatan === "Ketua" || (ketuaName && a.nama.toLowerCase() === ketuaName.toLowerCase())
    );
    if (!ketuaAnggota && ketuaName) {
      const { data: insK } = await supabase
        .from("anggota_divisi")
        .insert({
          divisi_id: profile.divisi_id,
          nama: ketuaName,
          jabatan: "Ketua",
          status: "aktif",
        })
        .select()
        .single();
      if (insK) ketuaAnggota = insK;
    }

    // Match or ensure Wakil in anggota_divisi so foreign key is satisfied
    let wakilAnggota = (existingAnggota ?? []).find(
      (a) => a.jabatan === "Wakil Ketua" || (wakilName && a.nama.toLowerCase() === wakilName.toLowerCase())
    );
    if (!wakilAnggota && wakilName) {
      const { data: insW } = await supabase
        .from("anggota_divisi")
        .insert({
          divisi_id: profile.divisi_id,
          nama: wakilName,
          jabatan: "Wakil Ketua",
          status: "aktif",
        })
        .select()
        .single();
      if (insW) wakilAnggota = insW;
    }

    // Dropdown strictly contains ONLY 2 names: Ketua and Wakil
    if (ketuaAnggota) {
      options.push({ id: ketuaAnggota.id, nama: `${ketuaAnggota.nama} (Ketua)` });
    } else if (ketuaName) {
      options.push({ id: ketuaName, nama: `${ketuaName} (Ketua)` });
    } else {
      options.push({ id: "ketua-dummy", nama: "Ketua Divisi (Belum diset di profil)" });
    }

    if (wakilAnggota) {
      options.push({ id: wakilAnggota.id, nama: `${wakilAnggota.nama} (Wakil Ketua)` });
    } else if (wakilName) {
      options.push({ id: wakilName, nama: `${wakilName} (Wakil Ketua)` });
    } else {
      options.push({ id: "wakil-dummy", nama: "Wakil Ketua (Belum diset di profil)" });
    }

    setPelaporOptions(options);

    // Check today's report
    const today = todayISO();
    const { data: todayReport } = await supabase
      .from("laporan_harian")
      .select("*")
      .eq("divisi_id", profile.divisi_id)
      .eq("tanggal", today)
      .maybeSingle();
    setReportToday(todayReport ?? null);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // Check if ?edit=id parameter is in URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      if (editId && profile.divisi_id) {
        (async () => {
          const { data: editTarget } = await supabase
            .from("laporan_harian")
            .select("*")
            .eq("id", editId)
            .maybeSingle();
          if (editTarget) {
            handleEdit(editTarget);
          }
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.divisi_id]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.tanggal) e.tanggal = "Tanggal wajib diisi.";
    if (!form.kegiatan_hari_ini.trim()) e.kegiatan_hari_ini = "Kegiatan wajib diisi.";
    if (!form.pelapor_id) e.pelapor_id = "Pilih nama pelapor.";
    if (!form.penerima_laporan) e.penerima_laporan = "Pilih penerima laporan.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id) return;
    if (!validate()) return;

    setSaving(true);

    const isUUID = /^[0-9a-fA-F-]{36}$/.test(form.pelapor_id);
    const payload = {
      divisi_id: profile.divisi_id,
      tanggal: form.tanggal,
      pelapor_id: isUUID ? form.pelapor_id : null,
      kegiatan_hari_ini: form.kegiatan_hari_ini,
      informasi_lain: form.informasi_lain || null,
      penerima_laporan: form.penerima_laporan || null,
    };

    // Flexible date handling (Requirement 6):
    const { data: existing } = await supabase
      .from("laporan_harian")
      .select("id")
      .eq("divisi_id", profile.divisi_id)
      .eq("tanggal", form.tanggal)
      .maybeSingle();

    let targetReportId = editingReport?.id || existing?.id;

    if (targetReportId) {
      const { error: upErr } = await supabase
        .from("laporan_harian")
        .update(payload)
        .eq("id", targetReportId);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui laporan: " + upErr.message);
        return;
      }
      await supabase.from("kendala_solusi").delete().eq("laporan_id", targetReportId);
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("laporan_harian")
        .insert(payload)
        .select()
        .single();
      if (insErr) {
        setSaving(false);
        error("Gagal menyimpan laporan: " + insErr.message);
        return;
      }
      targetReportId = ins.id;
    }

    // Upsert kendala & solusi
    if (targetReportId) {
      const rows = kendalaRows.filter((r) => r.kendala.trim() || r.solusi.trim());
      if (rows.length > 0) {
        await supabase.from("kendala_solusi").insert(
          rows.map((r) => ({ laporan_id: targetReportId!, kendala: r.kendala, solusi: r.solusi }))
        );
      }
    }

    setSaving(false);
    success(editingReport ? "Laporan berhasil diperbarui." : "Laporan berhasil disimpan.");

    // Clear form completely after save (Requirement 2)
    setForm(emptyForm);
    setKendalaRows([]);
    setEditingReport(null);
    setFormErrors({});

    // Automatically reload history (Requirement 5)
    await load();
  }

  async function handleEdit(report: LaporanHarian) {
    setEditingReport(report);
    setForm({
      tanggal: report.tanggal,
      pelapor_id: report.pelapor_id ?? "",
      kegiatan_hari_ini: report.kegiatan_hari_ini,
      informasi_lain: report.informasi_lain ?? "",
      penerima_laporan: report.penerima_laporan ?? "",
    });

    const { data: ks } = await supabase
      .from("kendala_solusi")
      .select("*")
      .eq("laporan_id", report.id);
    setKendalaRows((ks ?? []).map((k) => ({ kendala: k.kendala, solusi: k.solusi })));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingReport(null);
    setForm(emptyForm);
    setKendalaRows([]);
    setFormErrors({});
  }

  async function handleDelete(report: LaporanHarian) {
    if (!confirm(`Hapus laporan tanggal ${formatDate(report.tanggal)}?`)) return;
    const { error: delErr } = await supabase
      .from("laporan_harian")
      .delete()
      .eq("id", report.id);
    if (delErr) {
      error("Gagal menghapus laporan: " + delErr.message);
      return;
    }
    success("Laporan berhasil dihapus.");
    await load();
  }

  async function handleOpenDetail(report: LaporanHarian) {
    setDetailReport(report);
    setLoadingDetail(true);
    const { data: ks } = await supabase
      .from("kendala_solusi")
      .select("*")
      .eq("laporan_id", report.id);
    setDetailKendala(ks ?? []);
    setLoadingDetail(false);
  }

  const filteredHistory = useMemo(() => {
    if (!searchHistory.trim()) return history;
    const q = searchHistory.toLowerCase();
    return history.filter(
      (h) =>
        h.kegiatan_hari_ini.toLowerCase().includes(q) ||
        h.tanggal.includes(q) ||
        (h.penerima_laporan && h.penerima_laporan.toLowerCase().includes(q)) ||
        (h.informasi_lain && h.informasi_lain.toLowerCase().includes(q))
    );
  }, [history, searchHistory]);

  if (loading) return <Spinner />;

  if (!profile.divisi_id) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          Anda belum terhubung ke divisi. Hubungi administrator.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laporan Harian</h1>
          <p className="text-sm text-slate-500">
            {reportToday
              ? `Status hari ini: Laporan tanggal ${formatDate(todayISO())} sudah tercatat.`
              : "Status hari ini: Belum ada laporan yang tercatat untuk hari ini."}
          </p>
        </div>
        {reportToday && (
          <button
            type="button"
            onClick={() => handleOpenDetail(reportToday)}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            👁️ Lihat Laporan Hari Ini
          </button>
        )}
      </div>

      {/* Form Input Card */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {editingReport
                ? `Edit Laporan — Tanggal ${formatDate(editingReport.tanggal)}`
                : "Form Laporan Harian"}
            </h2>
            <p className="text-xs text-slate-500">
              {editingReport
                ? "Perbarui isi laporan, kegiatan, dan kendala/solusi."
                : "Pilih tanggal kapan saja (hari ini, susulan/kemarin, atau rencana esok)."}
            </p>
          </div>
          {editingReport && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ✕ Batal Edit (Form Baru)
            </button>
          )}
        </div>

        <CardContent className="pt-5">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Tanggal Laporan" error={formErrors.tanggal}>
                <Input
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                />
              </Field>

              <Field label="Pelapor (Ketua / Wakil)" error={formErrors.pelapor_id}>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={form.pelapor_id}
                  onChange={(e) => setForm({ ...form, pelapor_id: e.target.value })}
                >
                  <option value="">Pilih Pelapor (Ketua / Wakil)...</option>
                  {pelaporOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Penerima Laporan" error={formErrors.penerima_laporan}>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={form.penerima_laporan}
                  onChange={(e) => setForm({ ...form, penerima_laporan: e.target.value })}
                >
                  <option value="">Pilih penerima...</option>
                  <option value="ketua_umum">Ketua Umum</option>
                  <option value="ketua_1">Ketua 1</option>
                  <option value="ketua_2 OSIS">Ketua 2</option>
             
                </select>
              </Field>
            </div>

            <Field label="Kegiatan yang Dilakukan" error={formErrors.kegiatan_hari_ini}>
              <Textarea
                rows={3}
                value={form.kegiatan_hari_ini}
                onChange={(e) => setForm({ ...form, kegiatan_hari_ini: e.target.value })}
                placeholder="Tuliskan rincian kegiatan divisi untuk tanggal yang dipilih..."
              />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Kendala dan Solusi (Opsional)</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setKendalaRows([...kendalaRows, { kendala: "", solusi: "" }])}
                >
                  + Tambah Kendala
                </Button>
              </div>
              <div className="space-y-2">
                {kendalaRows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">
                    Tidak ada kendala. Klik &quot;+ Tambah Kendala&quot; jika ada kendala dan solusi yang ingin dicatat.
                  </p>
                ) : (
                  kendalaRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-2">
                      <Input
                        placeholder="Uraikan kendala yang dihadapi..."
                        value={row.kendala}
                        onChange={(e) => {
                          const next = [...kendalaRows];
                          next[idx] = { ...next[idx], kendala: e.target.value };
                          setKendalaRows(next);
                        }}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Solusi atau tindak lanjut..."
                          value={row.solusi}
                          onChange={(e) => {
                            const next = [...kendalaRows];
                            next[idx] = { ...next[idx], solusi: e.target.value };
                            setKendalaRows(next);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setKendalaRows(kendalaRows.filter((_, i) => i !== idx))
                          }
                          className="shrink-0 rounded-lg border border-slate-300 px-2.5 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition"
                          title="Hapus baris kendala"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Field label="Informasi Lain-lain (Opsional)">
              <Textarea
                rows={2}
                value={form.informasi_lain}
                onChange={(e) => setForm({ ...form, informasi_lain: e.target.value })}
                placeholder="Catatan tambahan atau pesan lainnya..."
              />
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} loading={saving}>
                {saving
                  ? "Menyimpan..."
                  : editingReport
                  ? "Perbarui Laporan"
                  : "Simpan Laporan"}
              </Button>
              {editingReport && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Riwayat Laporan with Search & Action Buttons (Requirement 1, 5, 7) */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Riwayat Laporan Divisi</h2>
            <p className="text-xs text-slate-500">
              Total {history.length} laporan tercatat
            </p>
          </div>
          {/* Search Input (Requirement 5) */}
          <div className="w-full sm:w-72">
            <Input
              placeholder=" Caririwayat kegiatan/tanggal..."
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
            />
          </div>
        </div>

        <CardContent className="pt-3">
          {filteredHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {searchHistory ? "Tidak ada laporan yang sesuai pencarian." : "Belum ada laporan."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3">Tanggal</th>
                    <th className="px-3 py-3">Kegiatan</th>
                    <th className="px-3 py-3">Penerima</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-800">
                        {formatDate(h.tanggal)}
                        {h.tanggal === todayISO() && (
                          <span className="ml-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Hari Ini
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-xs md:max-w-md truncate text-slate-600">
                        {h.kegiatan_hari_ini}
                      </td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                        {h.penerima_laporan || "-"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Badge color="green">Tersimpan</Badge>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {/* Action buttons with border (Requirement 1, 7) */}
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(h)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
                            title="Lihat rincian laporan beserta kendala dan solusi"
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(h)}
                            className="rounded-lg border border-blue-400 bg-blue-50/70 px-2.5 py-1 text-xs font-medium text-blue-700 shadow-sm transition hover:bg-blue-100"
                            title="Edit laporan ini"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(h)}
                            className="rounded-lg border border-red-400 bg-red-50/70 px-2.5 py-1 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-100"
                            title="Hapus laporan ini"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal with Kendala & Solusi (Requirement 1) */}
      <Modal
        open={Boolean(detailReport)}
        onClose={() => setDetailReport(null)}
        title={`Rincian Laporan — ${detailReport ? formatDate(detailReport.tanggal) : ""}`}
      >
        {detailReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400 font-medium">Tanggal</p>
                <p className="font-semibold text-slate-800">{formatDate(detailReport.tanggal)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400 font-medium">Penerima Laporan</p>
                <p className="font-semibold text-slate-800">{detailReport.penerima_laporan || "-"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kegiatan</p>
              <div className="mt-1.5 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 whitespace-pre-wrap">
                {detailReport.kegiatan_hari_ini}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kendala & Solusi</p>
              {loadingDetail ? (
                <div className="py-4 text-center text-xs text-slate-400">Memuat kendala...</div>
              ) : detailKendala.length > 0 ? (
                <div className="mt-1.5 space-y-2">
                  {detailKendala.map((k) => (
                    <div key={k.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm">
                      <p className="font-semibold text-red-700">Kendala: <span className="font-normal text-slate-800">{k.kendala}</span></p>
                      <p className="mt-1 font-semibold text-emerald-700">Solusi: <span className="font-normal text-slate-800">{k.solusi}</span></p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                  Tidak ada kendala yang dilaporkan pada tanggal ini.
                </p>
              )}
            </div>

            {detailReport.informasi_lain && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Informasi Lain-lain</p>
                <p className="mt-1 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {detailReport.informasi_lain}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const target = detailReport;
                  setDetailReport(null);
                  handleEdit(target);
                }}
                className="rounded-lg border border-blue-400 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 shadow-sm"
              >
                Edit Laporan Ini
              </button>
              <button
                type="button"
                onClick={() => setDetailReport(null)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
