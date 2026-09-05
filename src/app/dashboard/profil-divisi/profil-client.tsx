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
    const { error: upErr } = await supabase
      .from("divisi")
      .update({
        nama_divisi: form.nama_divisi,
        ketua_divisi: form.ketua_divisi || null,
        wakil_divisi: form.wakil_divisi || null,
        periode: form.periode || null,
        deskripsi: form.deskripsi || null,
      })
      .eq("id", profile.divisi_id);
    setSaving(false);
    if (upErr) {
      error("Gagal menyimpan profil divisi.");
      return;
    }
    success("Profil divisi disimpan.");
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
      <h1 className="text-2xl font-bold text-slate-900">Profil Divisi</h1>

      <Card>
        <CardHeader title="Informasi Divisi" subtitle="Lengkapi identitas divisi Anda" />
        <CardContent>
          <div className="space-y-4">
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
                />
              </Field>
              <Field label="Wakil Divisi">
                <Input
                  value={form.wakil_divisi}
                  onChange={(e) => setForm({ ...form, wakil_divisi: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Deskripsi">
              <Textarea
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving}>
                Simpan Profil
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
