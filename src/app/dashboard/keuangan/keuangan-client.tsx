"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, todayISO } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

interface FormState {
  tanggal: string;
  jenis_transaksi: "pemasukan" | "pengeluaran";
  keterangan: string;
  nominal: string;
}

const emptyForm: FormState = {
  tanggal: todayISO(),
  jenis_transaksi: "pemasukan",
  keterangan: "",
  nominal: "",
};

export function KeuanganClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [transaksi, setTransaksi] = useState<TransaksiKeuangan[]>([]);
  const [pemasukan, setPemasukan] = useState(0);
  const [pengeluaran, setPengeluaran] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransaksiKeuangan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("transaksi_keuangan")
      .select("*")
      .eq("divisi_id", profile.divisi_id)
      .order("tanggal", { ascending: false });

    const list = data ?? [];
    let masuk = 0;
    let keluar = 0;
    list.forEach((t) => {
      const n = Number(t.nominal) || 0;
      if (t.jenis_transaksi === "pemasukan") masuk += n;
      else keluar += n;
    });
    setTransaksi(list);
    setPemasukan(masuk);
    setPengeluaran(keluar);
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

  function openEdit(t: TransaksiKeuangan) {
    setEditing(t);
    setForm({
      tanggal: t.tanggal,
      jenis_transaksi: t.jenis_transaksi,
      keterangan: t.keterangan,
      nominal: String(Number(t.nominal)),
    });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.tanggal) e.tanggal = "Tanggal wajib diisi.";
    if (!form.keterangan.trim()) e.keterangan = "Keterangan wajib diisi.";
    const nominal = parseFloat(form.nominal);
    if (isNaN(nominal) || nominal < 0) e.nominal = "Nominal harus >= 0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);
    const payload = {
      divisi_id: profile.divisi_id,
      tanggal: form.tanggal,
      jenis_transaksi: form.jenis_transaksi,
      keterangan: form.keterangan,
      nominal: parseFloat(form.nominal),
    };

    if (editing) {
      const { error: upErr } = await supabase
        .from("transaksi_keuangan")
        .update(payload)
        .eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui transaksi.");
        return;
      }
      success("Transaksi diperbarui.");
    } else {
      const { error: insErr } = await supabase
        .from("transaksi_keuangan")
        .insert(payload);
      if (insErr) {
        setSaving(false);
        error("Gagal menambah transaksi.");
        return;
      }
      success("Transaksi ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(t: TransaksiKeuangan) {
    if (!confirm("Hapus transaksi ini?")) return;
    const { error: delErr } = await supabase
      .from("transaksi_keuangan")
      .delete()
      .eq("id", t.id);
    if (delErr) {
      error("Gagal menghapus transaksi.");
      return;
    }
    success("Transaksi dihapus.");
    load();
  }

  if (loading) return <Spinner />;

  const saldo = pemasukan - pengeluaran;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Keuangan Divisi</h1>
          <p className="text-sm text-slate-500">Kelola pemasukan dan pengeluaran divisi</p>
        </div>
        <Button onClick={openAdd}>+ Tambah Transaksi</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatRupiah(pemasukan)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pengeluaran</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatRupiah(pengeluaran)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Saldo</p>
            <p className={`mt-1 text-2xl font-bold ${saldo >= 0 ? "text-brand-600" : "text-red-600"}`}>
              {formatRupiah(saldo)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Riwayat Transaksi" />
        <CardContent>
          {transaksi.length === 0 ? (
            <EmptyState title="Belum ada transaksi" description="Tambahkan transaksi keuangan divisi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Keterangan</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.tanggal)}</td>
                      <td className="px-3 py-2">
                        <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                          {t.jenis_transaksi}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{t.keterangan}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatRupiah(t.nominal)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(t)} className="text-sm text-brand-600 hover:underline">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(t)} className="text-sm text-red-600 hover:underline">
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Transaksi" : "Tambah Transaksi"}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tanggal" error={errors.tanggal}>
              <Input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              />
            </Field>
            <Field label="Jenis Transaksi">
              <Select
                value={form.jenis_transaksi}
                onChange={(e) =>
                  setForm({ ...form, jenis_transaksi: e.target.value as "pemasukan" | "pengeluaran" })
                }
              >
                <option value="pemasukan">Pemasukan</option>
                <option value="pengeluaran">Pengeluaran</option>
              </Select>
            </Field>
          </div>
          <Field label="Keterangan" error={errors.keterangan}>
            <Input
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            />
          </Field>
          <Field label="Nominal (Rp)" error={errors.nominal}>
            <Input
              type="number"
              min="0"
              value={form.nominal}
              onChange={(e) => setForm({ ...form, nominal: e.target.value })}
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
