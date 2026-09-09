"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, todayISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

interface FormState {
  tanggal: string;
  jenis_transaksi: "pemasukan" | "pengeluaran";
  keterangan: string;
  nominal: string;
  bukti_url: string | null;
}

const emptyForm: FormState = {
  tanggal: todayISO(),
  jenis_transaksi: "pemasukan",
  keterangan: "",
  nominal: "",
  bukti_url: null,
};

export function extractBukti(raw: string): { cleanKeterangan: string; buktiUrl: string | null } {
  if (!raw) return { cleanKeterangan: "", buktiUrl: null };
  const match = raw.match(/\[BUKTI:([^\]]+)\]/);
  if (match) {
    return {
      cleanKeterangan: raw.replace(/\[BUKTI:[^\]]+\]/, "").trim(),
      buktiUrl: match[1],
    };
  }
  return { cleanKeterangan: raw, buktiUrl: null };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function KeuanganClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [transaksi, setTransaksi] = useState<TransaksiKeuangan[]>([]);
  const [pemasukan, setPemasukan] = useState(0);
  const [pengeluaran, setPengeluaran] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransaksiKeuangan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Search & Filter state (Requirement 5)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJenis, setFilterJenis] = useState<"all" | "pemasukan" | "pengeluaran">("all");

  // Receipt image upload state (Requirement 8)
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null);
  const [viewBuktiUrl, setViewBuktiUrl] = useState<string | null>(null);

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("transaksi_keuangan")
      .select("*")
      .eq("divisi_id", profile.divisi_id)
      .order("tanggal", { ascending: false });

    const list = data ?? [];
    let masuk = 0;
    let keluar = 0;
    list.forEach((t) => {
      const n = Number(t.nominal) || 0;
      if (t.jenis_transaksi === "pemasukan") masuk += n;
      else keluar += n;
    });
    setTransaksi(list);
    setPemasukan(masuk);
    setPengeluaran(keluar);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.divisi_id]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setBuktiFile(null);
    setBuktiPreview(null);
    setErrors({});
    setOpen(true);
  }

  function openEdit(t: TransaksiKeuangan) {
    setEditing(t);
    const { cleanKeterangan, buktiUrl } = extractBukti(t.keterangan);
    setForm({
      tanggal: t.tanggal,
      jenis_transaksi: t.jenis_transaksi,
      keterangan: cleanKeterangan,
      nominal: String(Number(t.nominal)),
      bukti_url: buktiUrl,
    });
    setBuktiFile(null);
    setBuktiPreview(buktiUrl);
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.tanggal) e.tanggal = "Tanggal wajib diisi.";
    if (!form.keterangan.trim()) e.keterangan = "Keterangan wajib diisi.";
    const nominal = parseFloat(form.nominal);
    if (isNaN(nominal) || nominal < 0) e.nominal = "Nominal harus >= 0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);

    let finalBuktiUrl = form.bukti_url;
    if (buktiFile) {
      try {
        const path = `bukti/${profile.divisi_id}/${Date.now()}-${buktiFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("program-kerja")
          .upload(path, buktiFile, { contentType: buktiFile.type });
        if (!upErr) {
          finalBuktiUrl = supabase.storage.from("program-kerja").getPublicUrl(path).data.publicUrl;
        } else {
          finalBuktiUrl = await fileToDataUrl(buktiFile);
        }
      } catch {
        finalBuktiUrl = await fileToDataUrl(buktiFile);
      }
    }

    const finalKeterangan = finalBuktiUrl
      ? `${form.keterangan.trim()} [BUKTI:${finalBuktiUrl}]`
      : form.keterangan.trim();

    const payload = {
      divisi_id: profile.divisi_id,
      tanggal: form.tanggal,
      jenis_transaksi: form.jenis_transaksi,
      keterangan: finalKeterangan,
      nominal: parseFloat(form.nominal),
    };

    if (editing) {
      const { error: upErr } = await supabase
        .from("transaksi_keuangan")
        .update(payload)
        .eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui transaksi: " + upErr.message);
        return;
      }
      success("Transaksi diperbarui.");
    } else {
      const { error: insErr } = await supabase
        .from("transaksi_keuangan")
        .insert(payload);
      if (insErr) {
        setSaving(false);
        error("Gagal menambah transaksi: " + insErr.message);
        return;
      }
      success("Transaksi ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(t: TransaksiKeuangan) {
    if (!confirm("Hapus transaksi ini?")) return;
    const { error: delErr } = await supabase
      .from("transaksi_keuangan")
      .delete()
      .eq("id", t.id);
    if (delErr) {
      error("Gagal menghapus transaksi.");
      return;
    }
    success("Transaksi dihapus.");
    load();
  }

  if (loading) return <Spinner />;

  const saldo = pemasukan - pengeluaran;

  const filteredTransaksi = transaksi.filter((t) => {
    const { cleanKeterangan } = extractBukti(t.keterangan);
    if (filterJenis !== "all" && t.jenis_transaksi !== filterJenis) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchKet = cleanKeterangan.toLowerCase().includes(q);
      const matchNom = String(t.nominal).includes(q);
      const matchTgl = t.tanggal.includes(q);
      return matchKet || matchNom || matchTgl;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Keuangan Divisi</h1>
          <p className="text-sm text-slate-500">Kelola dan pantau arus kas masuk, keluar, dan bukti struk</p>
        </div>
        <Button onClick={openAdd}>+ Tambah Transaksi</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatRupiah(pemasukan)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Pengeluaran</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatRupiah(pengeluaran)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Saldo Akhir</p>
            <p className={`mt-1 text-2xl font-bold ${saldo >= 0 ? "text-brand-600" : "text-red-600"}`}>
              {formatRupiah(saldo)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Riwayat Transaksi with Search & Filter Tabs (Requirement 5) */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Riwayat Transaksi</h2>
            <p className="text-xs text-slate-500">Total {transaksi.length} transaksi tercatat</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Filter Jenis Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setFilterJenis("all")}
                className={`rounded-md px-2.5 py-1 transition ${
                  filterJenis === "all" ? "bg-white text-slate-900 shadow-sm font-semibold" : "hover:text-slate-900"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterJenis("pemasukan")}
                className={`rounded-md px-2.5 py-1 transition ${
                  filterJenis === "pemasukan" ? "bg-emerald-50 text-emerald-700 shadow-sm font-semibold" : "hover:text-emerald-700"
                }`}
              >
                Pemasukan
              </button>
              <button
                type="button"
                onClick={() => setFilterJenis("pengeluaran")}
                className={`rounded-md px-2.5 py-1 transition ${
                  filterJenis === "pengeluaran" ? "bg-red-50 text-red-700 shadow-sm font-semibold" : "hover:text-red-700"
                }`}
              >
                Pengeluaran
              </button>
            </div>

            {/* Search Bar (Requirement 5) */}
            <div className="w-full sm:w-64">
              <Input
                placeholder="🔍 Cari transaksi/nominal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <CardContent className="pt-3">
          {filteredTransaksi.length === 0 ? (
            <EmptyState
              title={searchQuery ? "Transaksi tidak ditemukan" : "Belum ada transaksi"}
              description={searchQuery ? "Coba kata kunci pencarian yang lain." : "Tambahkan transaksi keuangan divisi."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3">Tanggal</th>
                    <th className="px-3 py-3">Jenis</th>
                    <th className="px-3 py-3">Keterangan</th>
                    <th className="px-3 py-3">Bukti Struk</th>
                    <th className="px-3 py-3 text-right">Nominal</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransaksi.map((t) => {
                    const { cleanKeterangan, buktiUrl } = extractBukti(t.keterangan);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-800">
                          {formatDate(t.tanggal)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                            {t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-slate-700 max-w-xs md:max-w-md truncate">
                          {cleanKeterangan}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {/* Requirement 8: View receipt image */}
                          {buktiUrl ? (
                            <button
                              type="button"
                              onClick={() => setViewBuktiUrl(buktiUrl)}
                              className="rounded-lg border border-emerald-400 bg-emerald-50/70 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 inline-flex items-center gap-1"
                            >
                               Lihat Bukti
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold whitespace-nowrap">
                          <span className={t.jenis_transaksi === "pemasukan" ? "text-emerald-600" : "text-red-600"}>
                            {t.jenis_transaksi === "pemasukan" ? "+ " : "- "}
                            {formatRupiah(t.nominal)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {/* Requirement 7: Action buttons with border */}
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(t)}
                              className="rounded-lg border border-blue-400 bg-blue-50/70 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(t)}
                              className="rounded-lg border border-red-400 bg-red-50/70 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah/Edit Transaksi (Requirement 8: with file upload) */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Transaksi" : "Tambah Transaksi"}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tanggal" error={errors.tanggal}>
              <Input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              />
            </Field>
            <Field label="Jenis Transaksi">
              <Select
                value={form.jenis_transaksi}
                onChange={(e) =>
                  setForm({ ...form, jenis_transaksi: e.target.value as "pemasukan" | "pengeluaran" })
                }
              >
                <option value="pemasukan">Pemasukan</option>
                <option value="pengeluaran">Pengeluaran</option>
              </Select>
            </Field>
          </div>
          <Field label="Keterangan" error={errors.keterangan}>
            <Input
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Contoh: Pembelian spanduk, Kas mingguan, Dana konsumsi..."
            />
          </Field>
          <Field label="Nominal (Rp)" error={errors.nominal}>
            <Input
              type="number"
              min="0"
              value={form.nominal}
              onChange={(e) => setForm({ ...form, nominal: e.target.value })}
              placeholder="0"
            />
          </Field>

          {/* Requirement 8: Upload Struk / Bukti Transaksi */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Foto Bukti / Struk / Nota (Opsional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setBuktiFile(f);
                if (f) {
                  const url = URL.createObjectURL(f);
                  setBuktiPreview(url);
                } else {
                  setBuktiPreview(form.bukti_url);
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            {buktiPreview && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <img src={buktiPreview} alt="Preview Bukti" className="h-16 w-16 rounded object-cover border" />
                <div className="flex-1 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Bukti gambar dipilih</p>
                  <p className="text-[11px] text-slate-400">Akan tersimpan bersama transaksi</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBuktiFile(null);
                    setBuktiPreview(null);
                    setForm({ ...form, bukti_url: null });
                  }}
                  className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Hapus Bukti
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {saving ? "Menyimpan..." : "Simpan Transaksi"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal View Bukti Struk (Requirement 8) */}
      <Modal open={Boolean(viewBuktiUrl)} onClose={() => setViewBuktiUrl(null)} title="Bukti Struk Transaksi">
        {viewBuktiUrl && (
          <div className="space-y-4">
            <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2 flex items-center justify-center">
              <img
                src={viewBuktiUrl}
                alt="Bukti Transaksi"
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <a
                href={viewBuktiUrl}
                target="_blank"
                rel="noreferrer"
                download="bukti-struk"
                className="rounded-lg border border-brand-500 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                Unduh Gambar
              </a>
              <button
                type="button"
                onClick={() => setViewBuktiUrl(null)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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

