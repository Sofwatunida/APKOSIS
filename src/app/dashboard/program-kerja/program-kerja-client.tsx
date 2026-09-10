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
    setItems((data ?? []).filter((p) => !p.deskripsi?.startsWith("[UNGGULAN]")));
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
    const cleanDeskripsi = p.deskripsi?.replace(/^\[UNGGULAN\]\s*/, "") ?? "";
    setForm({
      nama_program: p.nama_program ?? "",
      deskripsi: cleanDeskripsi,
      file: null,
    });
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

    const finalDeskripsi = form.deskripsi.trim();

    if (editing) {
      const payload: {
        nama_program: string;
        deskripsi: string | null;
        file_name?: string;
        file_path?: string;
      } = {
        nama_program: form.nama_program,
        deskripsi: finalDeskripsi || null,
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
        deskripsi: finalDeskripsi || null,
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

  // Requirement 3: Direct download file handler
  async function handleDownloadFile(item: ProgramKerja) {
    if (!item.file_path) return;
    try {
      const { data, error: downErr } = await supabase.storage.from("program-kerja").download(item.file_path);
      if (!downErr && data) {
        const blobUrl = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = item.file_name || "program-kerja";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
        return;
      }

      const { data: signed } = await supabase.storage.from("program-kerja").createSignedUrl(item.file_path, 300);
      if (signed?.signedUrl) {
        const a = document.createElement("a");
        a.href = signed.signedUrl;
        a.download = item.file_name || "program-kerja";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      const publicUrl = supabase.storage.from("program-kerja").getPublicUrl(item.file_path).data.publicUrl;
      window.open(publicUrl, "_blank");
    } catch (e: any) {
      error("Gagal mendownload file: " + (e?.message || "File tidak ditemukan"));
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Program Kerja Divisi</h1>
          <p className="text-sm text-slate-500">Kelola dan monitor program kerja divisi</p>
        </div>
        <Button onClick={openAdd}>+ Tambah Program Kerja</Button>
      </div>

      <Card>
        <CardHeader title="Daftar Program Kerja" subtitle={`Total ${items.length} program utama`} />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada program kerja" description="Tambahkan program kerja divisi Anda." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((p) => {
                const cleanDesc = p.deskripsi || "";
                return (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{p.nama_program}</h3>
                    </div>
                    {cleanDesc && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{cleanDesc}</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      {p.file_path && (
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(p)}
                          className="rounded-lg border border-brand-500 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 inline-flex items-center gap-1"
                        >
                          Download File
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="rounded-lg border border-blue-400 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
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
                        className="rounded-lg border border-red-400 bg-red-50/70 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah/Edit */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Program Kerja" : "Tambah Program Kerja"}>
        <div className="space-y-4">
          <Field label="Nama Program" error={errors.nama_program}>
            <Input
              value={form.nama_program}
              onChange={(e) => setForm({ ...form, nama_program: e.target.value })}
              placeholder="Contoh: Pengadaan Seragam, Bakti Sosial, Pelatihan..."
            />
          </Field>
          <Field label="Deskripsi">
            <Textarea
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Jelaskan tujuan dan sasaran program..."
            />
          </Field>

          <Field label="File Lampiran (PDF/DOC/DOCX/XLS/XLSX)" error={errors.file} hint={editing ? "Kosongkan jika tidak mengubah file." : undefined}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}