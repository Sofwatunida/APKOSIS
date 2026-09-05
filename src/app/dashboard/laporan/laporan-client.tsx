"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, LaporanHarian, KendalaSolusi } from "@/lib/types";
import { formatDate } from "@/lib/date";
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

export function LaporanHarianClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [reportToday, setReportToday] = useState<LaporanHarian | null>(null);
  const [kendalaToday, setKendalaToday] = useState<KendalaSolusi[]>([]);
  const [history, setHistory] = useState<LaporanHarian[]>([]);
  const [pelaporOptions, setPelaporOptions] = useState<{ id: string; nama: string }[]>([]);

  // form state
  const [form, setForm] = useState({
    tanggal: "",
    pelapor_id: "",
    kegiatan_hari_ini: "",
    informasi_lain: "",
    penerima_laporan: "",
  });
  const [kendalaRows, setKendalaRows] = useState<KendalaRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile.divisi_id) {
        setLoading(false);
        return;
      }
      const { data: reports } = await supabase
        .from("laporan_harian")
        .select("*")
        .eq("divisi_id", profile.divisi_id)
        .order("tanggal", { ascending: false })
        .limit(50);
      setHistory(reports ?? []);

      const { data: anggota } = await supabase
        .from("anggota_divisi")
        .select("id, nama, jabatan")
        .eq("divisi_id", profile.divisi_id);

      const filtered = (anggota ?? []).filter(
        (a) =>
          a.jabatan === "Ketua" ||
          a.jabatan === "Wakil Ketua" ||
          a.nama === profile.nama
      );
      setPelaporOptions(
        filtered.length > 0
          ? filtered
          : (anggota ?? []).map((a) => ({ id: a.id, nama: a.nama }))
      );

      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
        today.getDate()
      ).padStart(2, "0")}`;

      const { data: todayReport } = await supabase
        .from("laporan_harian")
        .select("*")
        .eq("divisi_id", profile.divisi_id)
        .eq("tanggal", iso)
        .maybeSingle();
      setReportToday(todayReport ?? null);

      if (todayReport) {
        setForm({
          tanggal: todayReport.tanggal,
          pelapor_id: todayReport.pelapor_id ?? "",
          kegiatan_hari_ini: todayReport.kegiatan_hari_ini,
          informasi_lain: todayReport.informasi_lain ?? "",
          penerima_laporan: todayReport.penerima_laporan ?? "",
        });
        const { data: ks } = await supabase
          .from("kendala_solusi")
          .select("*")
          .eq("laporan_id", todayReport.id);
        setKendalaToday(ks ?? []);
        setKendalaRows(
          (ks ?? []).map((k) => ({ kendala: k.kendala, solusi: k.solusi }))
        );
      } else {
        setForm((f) => ({ ...f, tanggal: iso }));
      }

      setLoading(false);
    }
    load();
  }, [profile.divisi_id, profile.nama]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.tanggal) e.tanggal = "Tanggal wajib diisi.";
    if (!form.kegiatan_hari_ini.trim()) e.kegiatan_hari_ini = "Kegiatan wajib diisi.";
    if (!form.pelapor_id) e.pelapor_id = "Pilih pelapor.";
    if (!form.penerima_laporan) e.penerima_laporan = "Pilih penerima laporan.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id) return;
    if (!validate()) return;

    setSaving(true);

    // duplicate check (in case editing a different date)
    const { data: existing } = await supabase
      .from("laporan_harian")
      .select("id")
      .eq("divisi_id", profile.divisi_id)
      .eq("tanggal", form.tanggal)
      .maybeSingle();

    if (existing && existing.id !== reportToday?.id) {
      setSaving(false);
      error("Laporan untuk tanggal ini sudah tersedia.");
      return;
    }

    const payload = {
      divisi_id: profile.divisi_id,
      tanggal: form.tanggal,
      pelapor_id: form.pelapor_id || null,
      kegiatan_hari_ini: form.kegiatan_hari_ini,
      informasi_lain: form.informasi_lain || null,
      penerima_laporan: form.penerima_laporan || null,
    };

    let laporanId = reportToday?.id;
    if (reportToday) {
      const { error: upErr } = await supabase
        .from("laporan_harian")
        .update(payload)
        .eq("id", reportToday.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui laporan.");
        return;
      }
      // replace kendala
      await supabase.from("kendala_solusi").delete().eq("laporan_id", reportToday.id);
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("laporan_harian")
        .insert(payload)
        .select()
        .single();
      if (insErr) {
        setSaving(false);
        if ((insErr as any).message?.includes("duplicate")) {
          error("Laporan untuk tanggal ini sudah tersedia.");
        } else {
          error("Gagal menyimpan laporan.");
        }
        return;
      }
      laporanId = ins.id;
    }

    // upsert kendala
    if (laporanId) {
      const rows = kendalaRows.filter((r) => r.kendala.trim() || r.solusi.trim());
      if (rows.length > 0) {
        await supabase.from("kendala_solusi").insert(
          rows.map((r) => ({ laporan_id: laporanId!, kendala: r.kendala, solusi: r.solusi }))
        );
      }
    }

    setSaving(false);
    success("Laporan berhasil disimpan.");
    router.refresh();
  }

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
              ? "Laporan hari ini sudah diisi."
              : "Anda belum mengisi laporan hari ini."}
          </p>
        </div>
        {reportToday && (
          <Button variant="outline" onClick={() => setShowView(true)}>
            Lihat Laporan Hari Ini
          </Button>
        )}
      </div>

      <Card>
        <CardHeader
          title={reportToday ? "Edit Laporan Hari Ini" : "Isi Laporan Hari Ini"}
          subtitle="Form laporan harian divisi"
        />
        <CardContent>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Tanggal" error={formErrors.tanggal}>
                <Input
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                />
              </Field>
              <Field label="Pelapor" error={formErrors.pelapor_id}>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={form.pelapor_id}
                  onChange={(e) => setForm({ ...form, pelapor_id: e.target.value })}
                >
                  <option value="">Pilih pelapor...</option>
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
                  <option value="Ketua 1">Ketua 1</option>
                  <option value="Ketua 2">Ketua 2</option>
                </select>
              </Field>
            </div>

            <Field label="Kegiatan Hari Ini" error={formErrors.kegiatan_hari_ini}>
              <Textarea
                value={form.kegiatan_hari_ini}
                onChange={(e) => setForm({ ...form, kegiatan_hari_ini: e.target.value })}
                placeholder="Jelaskan kegiatan yang dilakukan hari ini..."
              />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Kendala dan Solusi</Label>
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
                  <p className="text-sm text-slate-400">
                    Belum ada kendala. Klik &quot;+ Tambah Kendala&quot; untuk menambahkan.
                  </p>
                ) : (
                  kendalaRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                      <Input
                        placeholder="Kendala"
                        value={row.kendala}
                        onChange={(e) => {
                          const next = [...kendalaRows];
                          next[idx] = { ...next[idx], kendala: e.target.value };
                          setKendalaRows(next);
                        }}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Solusi"
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
                          className="shrink-0 rounded-lg border border-slate-200 px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Hapus kendala"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Field label="Informasi Lain-lain">
              <Textarea
                value={form.informasi_lain}
                onChange={(e) => setForm({ ...form, informasi_lain: e.target.value })}
                placeholder="Informasi tambahan (opsional)..."
              />
            </Field>

            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving}>
                {saving ? "Menyimpan..." : "Simpan Laporan"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader title="Riwayat Laporan" />
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Belum ada laporan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Kegiatan</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(h.tanggal)}</td>
                      <td className="px-3 py-2 max-w-md truncate">{h.kegiatan_hari_ini}</td>
                      <td className="px-3 py-2">
                        <Badge color="green">Selesai</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View modal */}
      <Modal open={showView} onClose={() => setShowView(false)} title="Laporan Hari Ini">
        {reportToday && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Tanggal</p>
                <p className="font-medium">{formatDate(reportToday.tanggal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Penerima</p>
                <p className="font-medium">{reportToday.penerima_laporan || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Kegiatan Hari Ini</p>
              <p className="whitespace-pre-wrap text-sm">{reportToday.kegiatan_hari_ini}</p>
            </div>
            {kendalaToday.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Kendala & Solusi</p>
                <div className="space-y-2">
                  {kendalaToday.map((k) => (
                    <div key={k.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p><span className="font-medium">Kendala:</span> {k.kendala}</p>
                      <p className="mt-1"><span className="font-medium">Solusi:</span> {k.solusi}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {reportToday.informasi_lain && (
              <div>
                <p className="text-xs text-slate-400">Informasi Lain</p>
                <p className="whitespace-pre-wrap text-sm">{reportToday.informasi_lain}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
