"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProgramKerja } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

const ALLOWED = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

interface FormState {
  nama_program: string;
  deskripsi: string;
  file: File | null;
}

const emptyForm: FormState = { nama_program: "", deskripsi: "", file: null };

export function ProgramKerjaClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProgramKerja[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramKerja | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("program_kerja")
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

  function openEdit(p: ProgramKerja) {
    setEditing(p);
    setForm({ nama_program: p.nama_program ?? "", deskripsi: p.deskripsi ?? "", file: null });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama_program.trim()) e.nama_program = "Nama program wajib diisi.";
    if (form.file && !ALLOWED.includes(form.file.type))
      e.file = "Format file harus PDF, DOC, DOCX, XLS, atau XLSX.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function uploadFile(userId: string): Promise<{ name: string; path: string } | null> {
    if (!form.file || !profile.divisi_id) return null;
    const ext = form.file.name.split(".").pop() || "file";
    const path = `${profile.divisi_id}/${Date.now()}-${form.file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("program-kerja")
      .upload(path, form.file, { contentType: form.file.type });
    if (upErr) return null;
    return { name: form.file.name, path };
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;

    let fileInfo: { name: string; path: string } | null = null;
    if (form.file) {
      fileInfo = await uploadFile(user?.id ?? "");
      if (!fileInfo && form.file) {
        setSaving(false);
        error("Gagal mengunggah file.");
        return;
      }
    }

    if (editing) {
      const payload: {
        nama_program: string;
        deskripsi: string | null;
        file_name?: string;
        file_path?: string;
      } = {
        nama_program: form.nama_program,
        deskripsi: form.deskripsi || null,
      };
      if (fileInfo) {
        payload.file_name = fileInfo.name;
        payload.file_path = fileInfo.path;
      }
      const { error: upErr } = await supabase.from("program_kerja").update(payload).eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui program kerja.");
        return;
      }
      success("Program kerja diperbarui.");
    } else {
      const { error: insErr } = await supabase.from("program_kerja").insert({
        divisi_id: profile.divisi_id,
        nama_program: form.nama_program,
        deskripsi: form.deskripsi || null,
        file_name: fileInfo?.name ?? null,
        file_path: fileInfo?.path ?? null,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) {
        setSaving(false);
        error("Gagal menambah program kerja.");
        return;
      }
      success("Program kerja ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  function downloadUrl(item: ProgramKerja) {
    if (!item.file_path) return null;
    return supabase.storage.from("program-kerja").getPublicUrl(item.file_path).data.publicUrl;
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Program Kerja Divisi</h1>
          <p className="text-sm text-slate-500">Kelola program kerja divisi</p>
        </div>
        <Button onClick={openAdd}>+ Tambah Program Kerja</Button>
      </div>

      <Card>
        <CardHeader title="Daftar Program Kerja" />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada program kerja" description="Tambahkan program kerja divisi Anda." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">{p.nama_program}</h3>
                  {p.deskripsi && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.deskripsi}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    {p.file_path && (
                      <a
                        href={downloadUrl(p) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-brand-600 hover:bg-slate-50"
                      >
                        Lihat File
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Hapus "${p.nama_program}"?`)) return;
                        if (p.file_path) await supabase.storage.from("program-kerja").remove([p.file_path]);
                        const { error: delErr } = await supabase.from("program_kerja").delete().eq("id", p.id);
                        if (delErr) {
                          error("Gagal menghapus program kerja.");
                          return;
                        }
                        success("Program kerja dihapus.");
                        load();
                      }}
                      className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Program Kerja" : "Tambah Program Kerja"}>
        <div className="space-y-4">
          <Field label="Nama Program" error={errors.nama_program}>
            <Input
              value={form.nama_program}
              onChange={(e) => setForm({ ...form, nama_program: e.target.value })}
            />
          </Field>
          <Field label="Deskripsi">
            <Textarea
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            />
          </Field>
          <Field label="File (PDF/DOC/DOCX/XLS/XLSX)" error={errors.file} hint={editing ? "Kosongkan jika tidak mengubah file." : undefined}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
