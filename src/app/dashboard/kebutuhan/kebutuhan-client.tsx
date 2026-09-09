"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Kebutuhan } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

const STATUS = ["belum_dibeli", "sudah_dibeli", "tidak_dibeli"];
const STATUS_LABEL: Record<string, string> = {
  belum_dibeli: "Belum Dibeli",
  sudah_dibeli: "Sudah Dibeli",
  tidak_dibeli: "Tidak Dibeli",
};

interface FormState {
  nama_kebutuhan: string;
  jumlah: string;
  keterangan: string;
  status_pembelian: string;
}

const emptyForm: FormState = {
  nama_kebutuhan: "",
  jumlah: "",
  keterangan: "",
  status_pembelian: "belum_dibeli",
};

export function KebutuhanClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Kebutuhan[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Kebutuhan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("kebutuhan")
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

  function openEdit(k: Kebutuhan) {
    setEditing(k);
    setForm({
      nama_kebutuhan: k.nama_kebutuhan,
      jumlah: k.jumlah != null ? String(k.jumlah) : "",
      keterangan: k.keterangan ?? "",
      status_pembelian: k.status_pembelian,
    });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama_kebutuhan.trim()) e.nama_kebutuhan = "Nama kebutuhan wajib diisi.";
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
      nama_kebutuhan: form.nama_kebutuhan,
      jumlah: form.jumlah === "" ? null : parseInt(form.jumlah),
      keterangan: form.keterangan || null,
      status_pembelian: form.status_pembelian,
    };

    if (editing) {
      const { error: upErr } = await supabase.from("kebutuhan").update(payload).eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui kebutuhan.");
        return;
      }
      success("Kebutuhan diperbarui.");
    } else {
      const { error: insErr } = await supabase.from("kebutuhan").insert(payload);
      if (insErr) {
        setSaving(false);
        error("Gagal menambah kebutuhan.");
        return;
      }
      success("Kebutuhan ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(k: Kebutuhan) {
    if (!confirm(`Hapus kebutuhan "${k.nama_kebutuhan}"?`)) return;
    const { error: delErr } = await supabase.from("kebutuhan").delete().eq("id", k.id);
    if (delErr) {
      error("Gagal menghapus kebutuhan.");
      return;
    }
    success("Kebutuhan dihapus.");
    load();
  }

  if (loading) return <Spinner />;

  const statusColor = (s: string) =>
    s === "sudah_dibeli" ? "text-emerald-600" : s === "tidak_dibeli" ? "text-slate-400" : "text-amber-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kebutuhan Divisi</h1>
          <p className="text-sm text-slate-500">Daftar kebutuhan yang diajukan divisi</p>
        </div>
        <Button onClick={openAdd}>+ Tambah Kebutuhan</Button>
      </div>

      <Card>
        <CardHeader title="Daftar Kebutuhan" />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada kebutuhan" description="Tambahkan kebutuhan divisi Anda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Kebutuhan</th>
                    <th className="px-3 py-2">Jumlah</th>
                    <th className="px-3 py-2">Status Pembelian</th>
                    <th className="px-3 py-2">Keterangan</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((k) => (
                    <tr key={k.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-medium">{k.nama_kebutuhan}</td>
                      <td className="px-3 py-2">{k.jumlah ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`font-medium ${statusColor(k.status_pembelian)}`}>
                          {STATUS_LABEL[k.status_pembelian] ?? k.status_pembelian}
                        </span>
                      </td>
                      <td className="px-3 py-2">{k.keterangan || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(k)}
                            className="rounded-md border border-blue-400 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 shadow-sm transition hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(k)}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Kebutuhan" : "Tambah Kebutuhan"}>
        <div className="space-y-4">
          <Field label="Nama Kebutuhan" error={errors.nama_kebutuhan}>
            <Input
              value={form.nama_kebutuhan}
              onChange={(e) => setForm({ ...form, nama_kebutuhan: e.target.value })}
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
            <Field label="Status Pembelian">
              <Select
                value={form.status_pembelian}
                onChange={(e) => setForm({ ...form, status_pembelian: e.target.value })}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
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
