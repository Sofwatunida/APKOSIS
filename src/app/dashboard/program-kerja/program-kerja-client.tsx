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
  const [notesList, setNotesList] = useState<string[]>([]);
  const [newNote, setNewNote] = useState("");

  const [unggulanItems, setUnggulanItems] = useState<ProgramKerja[]>([]);
  const [unggulanOpen, setUnggulanOpen] = useState(false);
  const [editingUnggulan, setEditingUnggulan] = useState<ProgramKerja | null>(null);
  const [unggulanForm, setUnggulanForm] = useState<{
    nama_program: string;
    deskripsi: string;
    file: File | null;
  }>({
    nama_program: "",
    deskripsi: "",
    file: null,
  });
  const [savingUnggulan, setSavingUnggulan] = useState(false);
  const [unggulanErrors, setUnggulanErrors] = useState<Record<string, string>>({});

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
    setUnggulanItems((data ?? []).filter((p) => p.deskripsi?.startsWith("[UNGGULAN]") ?? false));
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (profile.divisi_id) {
      supabase
        .from("divisi")
        .select("catatan_program_belum_terlaksana")
        .eq("id", profile.divisi_id)
        .maybeSingle()
        .then(({ data }) =>
          setNotesList(parseNoteList(data?.catatan_program_belum_terlaksana ?? ""))
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.divisi_id]);

  function parseNoteList(raw: string): string[] {
    return raw
      .split("\n")
      .map((l) => {
        let s = l.trim();
        while (/^[•▪◦●]\s*/.test(s)) s = s.replace(/^[•▪◦●]\s*/, "");
        while (/^-\s+/.test(s)) s = s.replace(/^-\s+/, "");
        while (/^\d+[.)]\s*/.test(s)) s = s.replace(/^\d+[.)]\s*/, "");
        return s.trim();
      })
      .filter(Boolean);
  }

  function addNote() {
    const v = newNote.trim();
    if (!v) return;
    setNotesList((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewNote("");
  }

  function removeNote(idx: number) {
    setNotesList((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveNotes() {
    if (!profile.divisi_id) return;
    const value = notesList.map((n) => n.trim()).filter(Boolean).join("\n");
    const { error: noteErr } = await supabase
      .from("divisi")
      .update({ catatan_program_belum_terlaksana: value })
      .eq("id", profile.divisi_id);
    if (noteErr) {
      error("Gagal menyimpan catatan.");
      return;
    }
    success("Catatan tersimpan.");
  }

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

  async function uploadFile(file: File): Promise<{ name: string; path: string } | null> {
    if (!profile.divisi_id) return null;
    const path = `${profile.divisi_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("program-kerja")
      .upload(path, file, { contentType: file.type });
    if (upErr) return null;
    return { name: file.name, path };
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;

    let fileInfo: { name: string; path: string } | null = null;
    if (form.file) {
      fileInfo = await uploadFile(form.file);
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

  function openAddUnggulan() {
    setEditingUnggulan(null);
    setUnggulanForm({ nama_program: "", deskripsi: "", file: null });
    setUnggulanErrors({});
    setUnggulanOpen(true);
  }

  function openEditUnggulan(p: ProgramKerja) {
    setEditingUnggulan(p);
    setUnggulanForm({
      nama_program: p.nama_program ?? "",
      deskripsi: p.deskripsi?.replace(/^\[UNGGULAN\]\s*/, "") ?? "",
      file: null,
    });
    setUnggulanErrors({});
    setUnggulanOpen(true);
  }

  function validateUnggulan() {
    const e: Record<string, string> = {};
    if (!unggulanForm.nama_program.trim()) e.nama_program = "Nama program unggulan wajib diisi.";
    if (!editingUnggulan && !unggulanForm.file)
      e.file = "Unggah file untuk program unggulan.";
    if (unggulanForm.file && !ALLOWED.includes(unggulanForm.file.type))
      e.file = "Format file harus PDF, DOC, DOCX, XLS, atau XLSX.";
    setUnggulanErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSaveUnggulan() {
    if (!profile.divisi_id || !validateUnggulan()) return;
    setSavingUnggulan(true);
    const user = (await supabase.auth.getUser()).data.user;

    let fileInfo: { name: string; path: string } | null = null;
    if (unggulanForm.file) {
      fileInfo = await uploadFile(unggulanForm.file);
      if (!fileInfo) {
        setSavingUnggulan(false);
        error("Gagal mengunggah file.");
        return;
      }
    }

    const finalDeskripsi = `[UNGGULAN]${unggulanForm.deskripsi.trim() ? ` ${unggulanForm.deskripsi.trim()}` : ""}`;

    if (editingUnggulan) {
      const payload: {
        nama_program: string;
        deskripsi: string | null;
        file_name?: string;
        file_path?: string;
      } = {
        nama_program: unggulanForm.nama_program,
        deskripsi: finalDeskripsi,
      };
      if (fileInfo) {
        payload.file_name = fileInfo.name;
        payload.file_path = fileInfo.path;
      }
      const { error: upErr } = await supabase
        .from("program_kerja")
        .update(payload)
        .eq("id", editingUnggulan.id);
      if (upErr) {
        setSavingUnggulan(false);
        error("Gagal memperbarui program unggulan.");
        return;
      }
      success("Program unggulan diperbarui.");
    } else {
      const { error: insErr } = await supabase.from("program_kerja").insert({
        divisi_id: profile.divisi_id,
        nama_program: unggulanForm.nama_program,
        deskripsi: finalDeskripsi,
        file_name: fileInfo?.name ?? null,
        file_path: fileInfo?.path ?? null,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) {
        setSavingUnggulan(false);
        error("Gagal menambah program unggulan.");
        return;
      }
      success("Program unggulan ditambahkan.");
    }

    setSavingUnggulan(false);
    setUnggulanOpen(false);
    load();
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
        <CardHeader
          title="Program Unggulan"
          subtitle="Program unggulan divisi yang dapat diunduh oleh role lain (monitoring, sekretaris, bendahara)"
          action={
            <Button onClick={openAddUnggulan} size="sm" variant="outline">
              + Tambah Program Unggulan
            </Button>
          }
        />
        <CardContent>
          {unggulanItems.length === 0 ? (
            <EmptyState
              title="Belum ada program unggulan"
              description="Unggah file program unggulan divisi Anda."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {unggulanItems.map((p) => {
                const cleanDesc = p.deskripsi?.replace(/^\[UNGGULAN\]\s*/, "") ?? "";
                return (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{p.nama_program}</h3>
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                        Unggulan
                      </span>
                    </div>
                    {cleanDesc && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{cleanDesc}</p>
                    )}
                    {p.file_name && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <span>📎</span>
                        <span className="truncate max-w-[220px]">{p.file_name}</span>
                      </p>
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
                        onClick={() => openEditUnggulan(p)}
                        className="rounded-lg border border-blue-400 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Hapus program unggulan "${p.nama_program}"?`)) return;
                          if (p.file_path) await supabase.storage.from("program-kerja").remove([p.file_path]);
                          const { error: delErr } = await supabase.from("program_kerja").delete().eq("id", p.id);
                          if (delErr) {
                            error("Gagal menghapus program unggulan.");
                            return;
                          }
                          success("Program unggulan dihapus.");
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

      {/* Catatan Program Belum Terlaksana */}
      <Card>
        <CardHeader
          title="Catatan Program Belum Terlaksana"
          subtitle="Tambahkan program kerja yang belum dapat dilaksanakan satu per satu agar rapi"
        />
        <CardContent>
          <p className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            Daftar ini akan dilihat dan diekspor oleh Sekretaris menjadi rekap program yang belum
            terlaksana seluruh divisi.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Nama program yang belum terlaksana..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNote();
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={addNote}>
              + Tambah
            </Button>
          </div>

          {notesList.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">
              Belum ada program yang dicatat. Klik &quot;+ Tambah&quot; untuk menambahkan program
              yang belum terlaksana.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {notesList.map((n, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="text-slate-800">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                      {idx + 1}
                    </span>
                    {n}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNote(idx)}
                    className="shrink-0 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition"
                  >
                    ✕ Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={saveNotes}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Simpan Catatan
            </button>
          </div>
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

      {/* Modal Tambah/Edit Program Unggulan */}
      <Modal
        open={unggulanOpen}
        onClose={() => setUnggulanOpen(false)}
        title={editingUnggulan ? "Edit Program Unggulan" : "Tambah Program Unggulan"}
      >
        <div className="space-y-4">
          <Field label="Nama Program" error={unggulanErrors.nama_program}>
            <Input
              value={unggulanForm.nama_program}
              onChange={(e) => setUnggulanForm({ ...unggulanForm, nama_program: e.target.value })}
              placeholder="Contoh: Program Unggulan Divisi..."
            />
          </Field>
          <Field label="Keterangan Singkat">
            <Textarea
              value={unggulanForm.deskripsi}
              onChange={(e) => setUnggulanForm({ ...unggulanForm, deskripsi: e.target.value })}
              placeholder="Tuliskan deskripsi singkat program unggulan ini..."
            />
          </Field>

          <Field
            label="File Lampiran (PDF/DOC/DOCX/XLS/XLSX)"
            error={unggulanErrors.file}
            hint={
              editingUnggulan
                ? "Kosongkan jika tidak mengubah file."
                : "Wajib diunggah agar dapat diunduh role lain."
            }
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setUnggulanForm({ ...unggulanForm, file: e.target.files?.[0] ?? null })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUnggulanOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveUnggulan} loading={savingUnggulan}>
              {savingUnggulan ? "Menyimpan..." : editingUnggulan ? "Perbarui" : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}