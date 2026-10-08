"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import {
  fetchKebutuhanDetail,
  isKebutuhanBaru,
  type KebutuhanDetail,
} from "@/lib/kebutuhan";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { KebutuhanStatusBadge } from "@/components/kebutuhan-status-badge";
import { ExportMenu } from "@/components/export-menu";
import { STATUS_KEBUTUHAN_LABEL } from "@/lib/kebutuhan";
import { formatDate, todayISO } from "@/lib/date";
import { Info } from "lucide-react";

interface FormState {
  nama_kebutuhan: string;
  jumlah: string;
  keterangan: string;
  tanggal: string;
}

const emptyForm: FormState = {
  nama_kebutuhan: "",
  jumlah: "",
  keterangan: "",
  tanggal: todayISO(),
};

export function KebutuhanClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<KebutuhanDetail[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KebutuhanDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    if (!profile.divisi_id) {
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchKebutuhanDetail(supabase, {
        divisiId: profile.divisi_id,
      });
      setItems(rows);
    } catch {
      error("Gagal memuat data kebutuhan.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.divisi_id]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, tanggal: todayISO() });
    setErrors({});
    setOpen(true);
  }

  function openEdit(k: KebutuhanDetail) {
    setEditing(k);
    setForm({
      nama_kebutuhan: k.nama_kebutuhan,
      jumlah: k.jumlah != null ? String(k.jumlah) : "",
      keterangan: k.keterangan ?? "",
      tanggal: k.tanggal,
    });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nama_kebutuhan.trim())
      e.nama_kebutuhan = "Nama kebutuhan wajib diisi.";
    if (form.jumlah !== "" && (isNaN(parseInt(form.jumlah)) || parseInt(form.jumlah) < 0))
      e.jumlah = "Jumlah harus >= 0.";
    if (!form.tanggal) e.tanggal = "Tanggal wajib diisi.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!profile.divisi_id || !validate()) return;
    setSaving(true);

    // `status` SENGAJA tidak dikirim saat insert/update:
    // status hanya boleh diubah Bendahara (RLS + trigger database).
    const payload = {
      divisi_id: profile.divisi_id,
      nama_kebutuhan: form.nama_kebutuhan,
      jumlah: form.jumlah === "" ? null : parseInt(form.jumlah),
      keterangan: form.keterangan || null,
      tanggal: form.tanggal,
      created_by: profile.id,
    };

    if (editing) {
      const { error: upErr } = await supabase
        .from("kebutuhan")
        .update(payload)
        .eq("id", editing.id);
      if (upErr) {
        setSaving(false);
        error("Gagal memperbarui kebutuhan.");
        return;
      }
      success("Kebutuhan diperbarui.");
    } else {
      const { error: insErr } = await supabase
        .from("kebutuhan")
        .insert(payload);
      if (insErr) {
        setSaving(false);
        error("Gagal menambah kebutuhan.");
        return;
      }
      success("Kebutuhan ditambahkan.");
    }

    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(k: KebutuhanDetail) {
    // Kebutuhan yang sudah diproses Bendahara tidak boleh dihapus supaya
    // riwayat pengajuan dana & keputusan tetap konsisten.
    if (!isKebutuhanBaru(k.status)) {
      error(
        `Kebutuhan "${k.nama_kebutuhan}" sudah berstatus ${STATUS_KEBUTUHAN_LABEL[k.status]} dan tidak bisa dihapus.`
      );
      return;
    }
    if (!confirm(`Hapus kebutuhan "${k.nama_kebutuhan}"?`)) return;
    const { error: delErr } = await supabase
      .from("kebutuhan")
      .delete()
      .eq("id", k.id);
    if (delErr) {
      error("Gagal menghapus kebutuhan.");
      return;
    }
    success("Kebutuhan dihapus.");
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Kebutuhan Divisi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Daftar kebutuhan yang diajukan divisi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            title="Kebutuhan Divisi"
            filename="kebutuhan-divisi"
            disabled={items.length === 0}
            columns={[
              { header: "Tanggal", key: "tanggal", width: 14 },
              { header: "Kebutuhan", key: "nama_kebutuhan", width: 25 },
              { header: "Jumlah", key: "jumlah", width: 10 },
              { header: "Status", key: "status", width: 18 },
              { header: "Keterangan", key: "keterangan", width: 30 },
            ]}
            rows={items.map((k) => ({
              tanggal: formatDate(k.tanggal_efektif),
              nama_kebutuhan: k.nama_kebutuhan,
              jumlah: k.jumlah ?? "-",
              status: STATUS_KEBUTUHAN_LABEL[k.status],
              keterangan: k.keterangan ?? "-",
            }))}
          />
          <Button onClick={openAdd}>+ Tambah Kebutuhan</Button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Status kebutuhan <strong>hanya dapat diubah oleh Bendahara</strong>. Anda
          tetap bisa menyesuaikan isi kebutuhan selama belum dihapus, dan
          kebutuhan yang sudah diproses tidak dapat dihapus.
        </p>
      </div>

      <Card>
        <CardHeader title="Daftar Kebutuhan" />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="Belum ada kebutuhan"
              description={'Tambahkan kebutuhan divisi Anda lewat tombol "+ Tambah Kebutuhan".'}
            />
          ) : (
            <TableWrap minWidth={860}>
              <THead>
                <tr>
                  <TH>Tanggal</TH>
                  <TH>Kebutuhan</TH>
                  <TH align="right">Jumlah</TH>
                  <TH>Status</TH>
                  <TH>Keterangan</TH>
                  <TH align="right">Aksi</TH>
                </tr>
              </THead>
              <TBody>
                {items.map((k) => (
                  <TR key={k.id}>
                    <TD className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(k.tanggal_efektif)}
                    </TD>
                    <TD className="min-w-[12rem] font-medium text-slate-900 dark:text-white">
                      <span className="safe-text block">{k.nama_kebutuhan}</span>
                      {k.kegiatan_laporan && (
                        <span className="mt-0.5 block text-xs text-slate-400">
                          dari laporan: {k.kegiatan_laporan}
                        </span>
                      )}
                    </TD>
                    <TD align="right" className="whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {k.jumlah ?? "-"}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <KebutuhanStatusBadge status={k.status} />
                    </TD>
                    <TD className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
                      <span className="safe-text block">{k.keterangan || "-"}</span>
                    </TD>
                    <TD align="right" className="whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(k)}
                          className="rounded-md border border-blue-400 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(k)}
                          disabled={!isKebutuhanBaru(k.status)}
                          title={
                            isKebutuhanBaru(k.status)
                              ? "Hapus kebutuhan"
                              : "Hanya kebutuhan berstatus \"Belum Diproses\" yang bisa dihapus"
                          }
                          className="rounded-md border border-red-400 bg-white px-2.5 py-1 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-900/20"
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Kebutuhan" : "Tambah Kebutuhan"}
      >
        <div className="space-y-4">
          <Field label="Nama Kebutuhan" error={errors.nama_kebutuhan}>
            <Input
              value={form.nama_kebutuhan}
              onChange={(e) =>
                setForm({ ...form, nama_kebutuhan: e.target.value })
              }
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
            <Field label="Tanggal" error={errors.tanggal}>
              <Input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
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
