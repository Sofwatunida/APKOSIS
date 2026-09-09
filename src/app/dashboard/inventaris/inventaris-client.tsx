"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Inventaris } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

const KONDISI = ["baik", "rusak_ringan", "rusak_berat", "hilang"];

interface FormState {
  nama_barang: string;
  jumlah: string;
  kondisi: string;
  keterangan: string;
}

const emptyForm: FormState = { nama_barang: "", jumlah: "", kondisi: "baik", keterangan: "" };

const KONDISI_LABEL: Record<string, string> = {
  baik: "Baik",
  rusak_ringan: "Rusak Ringan",
  rusak_berat: "Rusak Berat",
  hilang: "Hilang",
};

export function InventarisClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Inventaris[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inventaris | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("inventaris")
      .select("*")
      .eq("divisi_id", profile.divisi_id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.divisi_id]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setOpen(true);
  }

  function openEdit(i: Inventaris) {
    setEditing(i);
    setForm({
      nama_barang: i.nama_barang,
      jumlah: i.jumlah != null ? String(i.jumlah) : "",
      kondisi: i.kondisi ?? "baik",
      keterangan: i.keterangan ?? "",
    });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama_barang.trim()) e.nama_barang = "Nama barang wajib diisi.";
    if (form.jumlah !== "" && (isNaN(parseInt(form.jumlah)) || parseInt(form.jumlah) < 0))
      e.jumlah = "Jumlah harus >= 0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);
    const payload = {
      divisi_id: profile.divisi_id,
      nama_barang: form.nama_barang,
      jumlah: form.jumlah === "" ? null : parseInt(form.jumlah),
      kondisi: form.kondisi,
      keterangan: form.keterangan || null,
    };

    if (editing) {
      const { error: upErr } = await supabase
        .from("inventaris")
        .update(payload)
        .eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui inventaris.");
        return;
      }
      success("Inventaris diperbarui.");
    } else {
      const { error: insErr } = await supabase.from("inventaris").insert(payload);
      if (insErr) {
        setSaving(false);
        error("Gagal menambah inventaris.");
        return;
      }
      success("Inventaris ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(i: Inventaris) {
    if (!confirm(`Hapus barang "${i.nama_barang}"?`)) return;
    const { error: delErr } = await supabase.from("inventaris").delete().eq("id", i.id);
    if (delErr) {
      error("Gagal menghapus inventaris.");
      return;
    }
    success("Inventaris dihapus.");
    load();
  }

  if (loading) return <Spinner />;

  const kondisiColor = (k: string) =>
    k === "baik" ? "text-emerald-600" : k === "hilang" ? "text-red-600" : "text-amber-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventaris Divisi</h1>
          <p className="text-sm text-slate-500">Kelola barang inventaris divisi</p>
        </div>
        <Button onClick={openAdd}>+ Tambah Barang</Button>
      </div>

      <Card>
        <CardHeader title="Daftar Inventaris" />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada inventaris" description="Tambahkan barang inventaris divisi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Nama Barang</th>
                    <th className="px-3 py-2">Jumlah</th>
                    <th className="px-3 py-2">Kondisi</th>
                    <th className="px-3 py-2">Keterangan</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-medium">{i.nama_barang}</td>
                      <td className="px-3 py-2">{i.jumlah ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`font-medium ${kondisiColor(i.kondisi ?? "")}`}>
                          {KONDISI_LABEL[i.kondisi ?? ""] ?? i.kondisi}
                        </span>
                      </td>
                      <td className="px-3 py-2">{i.keterangan || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(i)}
                            className="rounded-md border border-blue-400 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 shadow-sm transition hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(i)}
                            className="rounded-md border border-red-400 bg-white px-2.5 py-1 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-50"
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Barang" : "Tambah Barang"}>
        <div className="space-y-4">
          <Field label="Nama Barang" error={errors.nama_barang}>
            <Input
              value={form.nama_barang}
              onChange={(e) => setForm({ ...form, nama_barang: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Jumlah" error={errors.jumlah}>
              <Input
                type="number"
                min="0"
                value={form.jumlah}
                onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
              />
            </Field>
            <Field label="Kondisi">
              <Select
                value={form.kondisi}
                onChange={(e) => setForm({ ...form, kondisi: e.target.value })}
              >
                {KONDISI.map((k) => (
                  <option key={k} value={k}>
                    {KONDISI_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Keterangan">
            <Textarea
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Simpan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
