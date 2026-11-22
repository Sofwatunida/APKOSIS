"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Inventaris } from "@/lib/types";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ExportMenu } from "@/components/export-menu";

const KONDISI = ["baik", "rusak_ringan", "rusak_berat", "hilang"];

interface FormState {
  nama_barang: string;
  jumlah: string;
  kondisi: string;
  keterangan: string;
}

const emptyForm: FormState = { nama_barang: "", jumlah: "", kondisi: "baik", keterangan: "" };

const KONDISI_LABEL: Record<string, string> = {
  baik: "Baik",
  rusak_ringan: "Rusak Ringan",
  rusak_berat: "Rusak Berat",
  hilang: "Hilang",
};

export function InventarisClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Inventaris[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inventaris | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("inventaris")
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

  function openEdit(i: Inventaris) {
    setEditing(i);
    setForm({
      nama_barang: i.nama_barang,
      jumlah: i.jumlah != null ? String(i.jumlah) : "",
      kondisi: i.kondisi ?? "baik",
      keterangan: i.keterangan ?? "",
    });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama_barang.trim()) e.nama_barang = "Nama barang wajib diisi.";
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
      nama_barang: form.nama_barang,
      jumlah: form.jumlah === "" ? null : parseInt(form.jumlah),
      kondisi: form.kondisi,
      keterangan: form.keterangan || null,
    };

    if (editing) {
      const { error: upErr } = await supabase
        .from("inventaris")
        .update(payload)
        .eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui inventaris.");
        return;
      }
      success("Inventaris diperbarui.");
    } else {
      const { error: insErr } = await supabase.from("inventaris").insert(payload);
      if (insErr) {
        setSaving(false);
        error("Gagal menambah inventaris.");
        return;
      }
      success("Inventaris ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(i: Inventaris) {
    if (!confirm(`Hapus barang "${i.nama_barang}"?`)) return;
    const { error: delErr } = await supabase.from("inventaris").delete().eq("id", i.id);
    if (delErr) {
      error("Gagal menghapus inventaris.");
      return;
    }
    success("Inventaris dihapus.");
    load();
  }

  if (loading) return <Spinner />;

  const kondisiColor = (k: string) =>
    k === "baik"
      ? "text-emerald-600 dark:text-emerald-400"
      : k === "hilang"
      ? "text-red-600 dark:text-red-400"
      : "text-amber-600 dark:text-amber-400";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventaris Divisi"
        action={
          <>
            <ExportMenu
              title="Inventaris Divisi"
              filename="inventaris-divisi"
              disabled={items.length === 0}
              columns={[
                { header: "Nama Barang", key: "nama_barang", width: 25 },
                { header: "Jumlah", key: "jumlah", width: 10 },
                { header: "Kondisi", key: "kondisi", width: 16 },
                { header: "Keterangan", key: "keterangan", width: 30 },
              ]}
              rows={items.map((i) => ({
                nama_barang: i.nama_barang,
                jumlah: i.jumlah ?? "-",
                kondisi: KONDISI_LABEL[i.kondisi ?? ""] ?? i.kondisi ?? "-",
                keterangan: i.keterangan ?? "-",
              }))}
            />
            <Button onClick={openAdd}>+ Tambah Barang</Button>
          </>
        }
      />

      <Card>
        <CardHeader title="Daftar Inventaris" />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada inventaris" description="Tambahkan barang inventaris divisi." />
          ) : (
            <TableWrap minWidth={560}>
              <THead>
                <tr>
                  <TH>Nama Barang</TH>
                  <TH>Jumlah</TH>
                  <TH>Kondisi</TH>
                  <TH>Keterangan</TH>
                  <TH align="right">Aksi</TH>
                </tr>
              </THead>
              <TBody>
                {items.map((i) => (
                  <TR key={i.id}>
                    <TD className="font-medium">{i.nama_barang}</TD>
                    <TD>{i.jumlah ?? "-"}</TD>
                    <TD className="whitespace-nowrap">
                      <span className={`font-medium ${kondisiColor(i.kondisi ?? "")}`}>
                        {KONDISI_LABEL[i.kondisi ?? ""] ?? i.kondisi}
                      </span>
                    </TD>
                    <TD className="text-xs text-slate-600 dark:text-slate-400">{i.keterangan || "-"}</TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(i)}
                          className="rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-xs transition hover:bg-blue-100 active:scale-[0.98] dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(i)}
                          className="rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-xs font-semibold text-rose-700 shadow-xs transition hover:bg-rose-100 active:scale-[0.98] dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-400"
                        >
                          Hapus
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Barang" : "Tambah Barang"}>
        <div className="space-y-4">
          <Field label="Nama Barang" error={errors.nama_barang}>
            <Input
              value={form.nama_barang}
              onChange={(e) => setForm({ ...form, nama_barang: e.target.value })}
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
            <Field label="Kondisi">
              <Select
                value={form.kondisi}
                onChange={(e) => setForm({ ...form, kondisi: e.target.value })}
              >
                {KONDISI.map((k) => (
                  <option key={k} value={k}>
                    {KONDISI_LABEL[k]}
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
