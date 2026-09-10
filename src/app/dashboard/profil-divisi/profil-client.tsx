"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Divisi, AnggotaDivisi } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function ProfilDivisiClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [divisi, setDivisi] = useState<Divisi | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    nama_divisi: "",
    periode: "",
    deskripsi: "",
    ketua_divisi: "",
    wakil_divisi: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ketua, setKetua] = useState<AnggotaDivisi | null>(null);
  const [wakil, setWakil] = useState<AnggotaDivisi | null>(null);

  useEffect(() => {
    async function load() {
      if (!profile.divisi_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("divisi")
        .select("*")
        .eq("id", profile.divisi_id)
        .single();
      setDivisi(data ?? null);
      if (data) {
        setForm({
          nama_divisi: data.nama_divisi,
          periode: data.periode ?? "",
          deskripsi: data.deskripsi ?? "",
          ketua_divisi: data.ketua_divisi ?? "",
          wakil_divisi: data.wakil_divisi ?? "",
        });
        // If profile is already filled, start in view/edit mode
        const isFilled = Boolean(data.deskripsi);
        setIsEditing(!isFilled);
      }
      
      // Load ketua and wakil from anggota list
      const { data: anggotaList } = await supabase
        .from("anggota_divisi")
        .select("*")
        .eq("divisi_id", profile.divisi_id)
        .eq("status", "aktif");
      
      if (anggotaList) {
        const foundKetua = anggotaList.find(a => 
          a.jabatan?.toLowerCase().includes("ketua") && 
          !a.jabatan?.toLowerCase().includes("wakil")
        );
        const foundWakil = anggotaList.find(a => 
          a.jabatan?.toLowerCase().includes("wakil")
        );
        setKetua(foundKetua ?? null);
        setWakil(foundWakil ?? null);
      }
      
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.divisi_id]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama_divisi.trim()) e.nama_divisi = "Nama divisi wajib diisi.";
    if (!form.ketua_divisi.trim()) e.ketua_divisi = "Nama ketua wajib diisi.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);
    const payload = {
      nama_divisi: form.nama_divisi,
      periode: form.periode || null,
      deskripsi: form.deskripsi || null,
      ketua_divisi: form.ketua_divisi.trim() || null,
      wakil_divisi: form.wakil_divisi.trim() || null,
    };
    const { error: upErr } = await supabase
      .from("divisi")
      .update(payload)
      .eq("id", profile.divisi_id);
    if (upErr) {
      setSaving(false);
      error("Gagal menyimpan profil divisi: " + upErr.message);
      return;
    }

    // Auto-sync ketua & wakil ke anggota_divisi
    const syncAnggota = async (
      nama: string,
      jabatan: string
    ): Promise<boolean> => {
      if (!nama) return true;
      const { data: existing } = await supabase
        .from("anggota_divisi")
        .select("id")
        .eq("divisi_id", profile.divisi_id!)
        .eq("jabatan", jabatan)
        .maybeSingle();
      if (existing) {
        const { error: synErr } = await supabase
          .from("anggota_divisi")
          .update({ nama, status: "aktif" })
          .eq("id", existing.id);
        return !synErr;
      }
      const { error: insErr } = await supabase
        .from("anggota_divisi")
        .insert({
          divisi_id: profile.divisi_id!,
          nama,
          jabatan,
          status: "aktif",
        });
      return !insErr;
    };

    const ketuaOk = await syncAnggota(form.ketua_divisi.trim(), "Ketua");
    const wakilOk = await syncAnggota(form.wakil_divisi.trim(), "Wakil Ketua");
    if (!ketuaOk || !wakilOk) {
      setSaving(false);
      error("Profil divisi tersimpan, tetapi gagal menyinkronkan anggota.");
      return;
    }

    setSaving(false);
    // Update local divisi state
    setDivisi((prev) => (prev ? { ...prev, ...payload } : null));
    setKetua((prev) =>
      form.ketua_divisi.trim()
        ? prev
          ? { ...prev, nama: form.ketua_divisi.trim() }
          : {
              id: "",
              divisi_id: profile.divisi_id!,
              nama: form.ketua_divisi.trim(),
              jabatan: "Ketua",
              status: "aktif",
              tanggal_masuk: null,
              tanggal_keluar: null,
              keterangan: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
        : null
    );
    setWakil((prev) =>
      form.wakil_divisi.trim()
        ? prev
          ? { ...prev, nama: form.wakil_divisi.trim() }
          : {
              id: "",
              divisi_id: profile.divisi_id!,
              nama: form.wakil_divisi.trim(),
              jabatan: "Wakil Ketua",
              status: "aktif",
              tanggal_masuk: null,
              tanggal_keluar: null,
              keterangan: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
        : null
    );
    setIsEditing(false); // Switch button to Edit Profil (Requirement 4)
    success("Profil divisi berhasil disimpan.");
    router.refresh();
  }

  if (loading) return <Spinner />;

  if (!divisi) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          Anda belum terhubung ke divisi.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profil Divisi</h1>
          <p className="text-sm text-slate-500">Identitas dan kepengurusan divisi</p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-blue-400 bg-blue-50/80 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            Edit Profil
          </button>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isEditing ? "Form Edit Profil Divisi" : "Informasi Profil Divisi"}
            </h2>
            <p className="text-xs text-slate-500">
              {isEditing
                ? "Ubah data nama divisi, periode, dan deskripsi."
                : "Profil divisi yang tersimpan saat ini."}
            </p>
          </div>
          {!isEditing && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Tersimpan
            </span>
          )}
        </div>

        <CardContent className="pt-6">
          {!isEditing ? (
            /* Read-Only View when saved */
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Nama Divisi
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{divisi.nama_divisi}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Periode
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{divisi.periode || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Ketua Divisi
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-800">
                    {ketua?.nama || <span className="text-slate-400 font-normal">Belum diisi</span>}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Wakil Divisi
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-800">
                    {wakil?.nama || <span className="text-slate-400 font-normal">Belum diisi</span>}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Deskripsi / Tugas Pokok Divisi
                </p>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {divisi.deskripsi || (
                    <span className="text-slate-400 italic">Belum ada deskripsi divisi.</span>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg border border-blue-400 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
                >
                  Edit Profil
                </button>
              </div>
            </div>
          ) : (
            /* Editable Form Mode */
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nama Divisi" error={errors.nama_divisi}>
                  <Input
                    value={form.nama_divisi}
                    onChange={(e) => setForm({ ...form, nama_divisi: e.target.value })}
                  />
                </Field>
                <Field label="Periode">
                  <Input
                    value={form.periode}
                    onChange={(e) => setForm({ ...form, periode: e.target.value })}
                    placeholder="2026/2027"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Ketua Divisi" error={errors.ketua_divisi}>
                  <Input
                    value={form.ketua_divisi}
                    onChange={(e) => setForm({ ...form, ketua_divisi: e.target.value })}
                    placeholder="Nama ketua divisi"
                  />
                </Field>
                <Field label="Wakil Divisi">
                  <Input
                    value={form.wakil_divisi}
                    onChange={(e) => setForm({ ...form, wakil_divisi: e.target.value })}
                    placeholder="Nama wakil divisi"
                  />
                </Field>
              </div>
              <Field label="Deskripsi">
                <Textarea
                  rows={4}
                  value={form.deskripsi}
                  onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                  placeholder="Uraikan tugas pokok, fungsi, dan wewenang divisi..."
                />
              </Field>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} loading={saving}>
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
                {divisi && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        nama_divisi: divisi.nama_divisi,
                        periode: divisi.periode ?? "",
                        deskripsi: divisi.deskripsi ?? "",
                        ketua_divisi: divisi.ketua_divisi ?? "",
                        wakil_divisi: divisi.wakil_divisi ?? "",
                      });
                      setIsEditing(false);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
