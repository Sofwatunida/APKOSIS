"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, AnggotaDivisi } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

interface FormState {
  nama: string;
  jabatan: string;
  status: string;
  tanggal_masuk: string;
  tanggal_keluar: string;
  keterangan: string;
}

const emptyForm: FormState = {
  nama: "",
  jabatan: "",
  status: "aktif",
  tanggal_masuk: "",
  tanggal_keluar: "",
  keterangan: "",
};

export function AnggotaClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [anggota, setAnggota] = useState<AnggotaDivisi[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnggotaDivisi | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("anggota_divisi")
      .select("*")
      .eq("divisi_id", profile.divisi_id)
      .order("created_at", { ascending: true });
    setAnggota(data ?? []);
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

  function openEdit(a: AnggotaDivisi) {
    setEditing(a);
    setForm({
      nama: a.nama,
      jabatan: a.jabatan ?? "",
      status: a.status,
      tanggal_masuk: a.tanggal_masuk ?? "",
      tanggal_keluar: a.tanggal_keluar ?? "",
      keterangan: a.keterangan ?? "",
    });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama.trim()) e.nama = "Nama wajib diisi.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);

    if (editing) {
      const { error: upErr } = await supabase
        .from("anggota_divisi")
        .update({
          nama: form.nama,
          jabatan: form.jabatan || null,
          status: form.status,
          tanggal_masuk: form.tanggal_masuk || null,
          tanggal_keluar: form.tanggal_keluar || null,
          keterangan: form.keterangan || null,
        })
        .eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui anggota.");
        return;
      }
      success("Anggota berhasil diperbarui.");
    } else {
      const { error: insErr } = await supabase.from("anggota_divisi").insert({
        divisi_id: profile.divisi_id,
        nama: form.nama,
        jabatan: form.jabatan || null,
        status: form.status,
        tanggal_masuk: form.tanggal_masuk || null,
        tanggal_keluar: form.tanggal_keluar || null,
        keterangan: form.keterangan || null,
      });
      if (insErr) {
        setSaving(false);
        error("Gagal menambah anggota.");
        return;
      }
      success("Anggota berhasil ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(a: AnggotaDivisi) {
    if (!confirm(`Hapus anggota "${a.nama}"?`)) return;
    const { error: delErr } = await supabase
      .from("anggota_divisi")
      .delete()
      .eq("id", a.id);
    if (delErr) {
      error("Gagal menghapus anggota.");
      return;
    }
    success("Anggota dihapus.");
    load();
  }

  if (loading) return <Spinner />;

  const aktif = anggota.filter((a) => a.status === "aktif");
  const nonaktif = anggota.filter((a) => a.status === "nonaktif");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Anggota Divisi</h1>
          <p className="text-sm text-slate-500">
            {aktif.length} anggota aktif, {nonaktif.length} nonaktif
          </p>
        </div>
        <Button onClick={openAdd}>+ Tambah Anggota</Button>
      </div>

      <Card>
        <CardContent>
          {anggota.length === 0 ? (
            <EmptyState title="Belum ada anggota" description="Tambahkan anggota divisi Anda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Jabatan</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {[...aktif, ...nonaktif].map((a) => (
                    <tr key={a.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-medium">{a.nama}</td>
                      <td className="px-3 py-2">{a.jabatan || "-"}</td>
                      <td className="px-3 py-2">
                        <Badge color={a.status === "aktif" ? "green" : "red"}>
                          {a.status === "aktif" ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(a)}
                            className="text-sm text-brand-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(a)}
                            className="text-sm text-red-600 hover:underline"
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Anggota" : "Tambah Anggota"}
      >
        <div className="space-y-4">
          <Field label="Nama" error={errors.nama}>
            <Input
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </Field>
          <Field label="Jabatan">
            <Input
              value={form.jabatan}
              onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
              placeholder="Contoh: Ketua, Wakil Ketua, Sekretaris, Anggota"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </Select>
            </Field>
            <Field label="Tanggal Masuk">
              <Input
                type="date"
                value={form.tanggal_masuk}
                onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })}
              />
            </Field>
            <Field label="Tanggal Keluar">
              <Input
                type="date"
                value={form.tanggal_keluar}
                onChange={(e) => setForm({ ...form, tanggal_keluar: e.target.value })}
              />
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
