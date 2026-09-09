"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Divisi } from "@/lib/types";
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
    ketua_divisi: "",
    wakil_divisi: "",
    periode: "",
    deskripsi: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
          ketua_divisi: data.ketua_divisi ?? "",
          wakil_divisi: data.wakil_divisi ?? "",
          periode: data.periode ?? "",
          deskripsi: data.deskripsi ?? "",
        });
        // If profile is already filled, start in view/edit mode
        const isFilled = Boolean(data.ketua_divisi || data.wakil_divisi || data.deskripsi);
        setIsEditing(!isFilled);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.divisi_id]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama_divisi.trim()) e.nama_divisi = "Nama divisi wajib diisi.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);
    const payload = {
      nama_divisi: form.nama_divisi,
      ketua_divisi: form.ketua_divisi || null,
      wakil_divisi: form.wakil_divisi || null,
      periode: form.periode || null,
      deskripsi: form.deskripsi || null,
    };
    const { error: upErr } = await supabase
      .from("divisi")
      .update(payload)
      .eq("id", profile.divisi_id);
    setSaving(false);
    if (upErr) {
      error("Gagal menyimpan profil divisi: " + upErr.message);
      return;
    }
    // Update local divisi state
    setDivisi((prev) => (prev ? { ...prev, ...payload } : null));
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
                ? "Ubah data nama divisi, ketua, wakil, dan deskripsi."
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
                    {divisi.ketua_divisi || <span className="text-slate-400 font-normal">Belum diisi</span>}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Wakil Divisi
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-800">
                    {divisi.wakil_divisi || <span className="text-slate-400 font-normal">Belum diisi</span>}
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
                <Field label="Ketua Divisi">
                  <Input
                    value={form.ketua_divisi}
                    onChange={(e) => setForm({ ...form, ketua_divisi: e.target.value })}
                    placeholder="Nama lengkap ketua divisi"
                  />
                </Field>
                <Field label="Wakil Divisi">
                  <Input
                    value={form.wakil_divisi}
                    onChange={(e) => setForm({ ...form, wakil_divisi: e.target.value })}
                    placeholder="Nama lengkap wakil divisi"
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
                        ketua_divisi: divisi.ketua_divisi ?? "",
                        wakil_divisi: divisi.wakil_divisi ?? "",
                        periode: divisi.periode ?? "",
                        deskripsi: divisi.deskripsi ?? "",
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
