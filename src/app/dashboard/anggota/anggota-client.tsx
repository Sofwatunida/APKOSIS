"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, AnggotaDivisi } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { ExportMenu } from "@/components/export-menu";
import { sortByJabatan } from "@/lib/jabatan";
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Pencil,
  Trash2,
  Search,
  Briefcase,
} from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"semua" | "aktif" | "nonaktif">("semua");

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

  const aktif = sortByJabatan(anggota.filter((a) => a.status === "aktif"));
  const nonaktif = sortByJabatan(anggota.filter((a) => a.status === "nonaktif"));

  const filtered = (
    statusFilter === "aktif"
      ? aktif
      : statusFilter === "nonaktif"
      ? nonaktif
      : [...aktif, ...nonaktif]
  ).filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.nama.toLowerCase().includes(q) ||
      (a.jabatan && a.jabatan.toLowerCase().includes(q)) ||
      (a.keterangan && a.keterangan.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Anggota Divisi</h1>
              <p className="text-sm text-slate-500">
                Kelola daftar personil dan pembagian peran divisi OSIS
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ExportMenu
            title="Anggota Divisi"
            filename="anggota-divisi"
            disabled={anggota.length === 0}
            columns={[
              { header: "Nama", key: "nama", width: 25 },
              { header: "Jabatan", key: "jabatan", width: 18 },
              { header: "Status", key: "status", width: 12 },
              { header: "Tanggal Masuk", key: "tanggal_masuk", width: 14 },
              { header: "Tanggal Keluar", key: "tanggal_keluar", width: 14 },
              { header: "Keterangan", key: "keterangan", width: 30 },
            ]}
            rows={[...aktif, ...nonaktif].map((a) => ({
              nama: a.nama,
              jabatan: a.jabatan ?? "-",
              status: a.status === "aktif" ? "Aktif" : "Nonaktif",
              tanggal_masuk: a.tanggal_masuk ?? "-",
              tanggal_keluar: a.tanggal_keluar ?? "-",
              keterangan: a.keterangan ?? "-",
            }))}
          />
          <Button onClick={openAdd} className="shadow-sm">
            <UserPlus className="mr-1.5 h-4 w-4" />
            Tambah Anggota
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Personil</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">{anggota.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Anggota Aktif</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">{aktif.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <UserX className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Nonaktif / Demisioner</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">{nonaktif.length}</p>
          </div>
        </div>
      </div>

      {/* Main List Card */}
      <Card>
        <CardHeader
          title="Daftar Pengurus & Anggota"
          subtitle="Seluruh anggota yang terdaftar dalam divisi Anda"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau jabatan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-48 rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 sm:w-64"
                />
              </div>
              <div className="flex rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 text-xs">
                {(["semua", "aktif", "nonaktif"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`rounded-lg px-2.5 py-1 font-medium capitalize transition ${
                      statusFilter === tab
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          }
        />
        <CardContent className="p-0">
          {anggota.length === 0 ? (
            <div className="p-6">
              <EmptyState title="Belum ada anggota" description="Tambahkan personil divisi Anda menggunakan tombol Tambah Anggota di atas." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="Tidak ada hasil" description={`Tidak ditemukan anggota dengan kata kunci "${search}".`} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Nama & Profil</th>
                    <th className="px-5 py-3.5">Jabatan</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Keterangan</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((a) => {
                    const initials = a.nama
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <tr key={a.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-indigo-100 text-xs font-bold text-brand-700 ring-1 ring-brand-500/20">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{a.nama}</p>
                              {a.tanggal_masuk && (
                                <p className="text-xs text-slate-400">
                                  Masuk: {a.tanggal_masuk}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {a.jabatan ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                              <Briefcase className="h-3 w-3 text-slate-400" />
                              {a.jabatan}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge color={a.status === "aktif" ? "green" : "slate"} dot>
                            {a.status === "aktif" ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </td>
                        <td className="max-w-xs truncate px-5 py-3.5 text-xs text-slate-500">
                          {a.keterangan || "-"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(a)}
                              className="h-8 px-2.5 text-slate-600 hover:bg-brand-50 hover:text-brand-600"
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(a)}
                              className="h-8 px-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Hapus
                            </Button>
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
