"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import {
  fetchPengajuanDanaDetail,
  STATUS_PERSETUJUAN_LABEL,
  STATUS_PERSETUJUAN_COLOR,
  STATUS_PENGAMBILAN_LABEL,
  STATUS_PENGAMBILAN_COLOR,
  type PengajuanDanaDetail,
} from "@/lib/pengajuan-dana";
import { validatePengajuanDana } from "@/lib/validation";
import { formatDate, todayISO } from "@/lib/date";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ExportMenu } from "@/components/export-menu";
import { HandCoins, Plus, Info } from "lucide-react";

interface FormState {
  kebutuhan_id: string;
  tanggal_pengajuan: string;
  nominal: string;
  keperluan: string;
}

const emptyForm: FormState = {
  kebutuhan_id: "",
  tanggal_pengajuan: todayISO(),
  nominal: "",
  keperluan: "",
};

export function PengajuanDanaClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PengajuanDanaDetail[]>([]);
  // Kebutuhan milik divisi ini yang BELUM punya pengajuan -> pilihan form.
  const [pilihanKebutuhan, setPilihanKebutuhan] = useState<
    { id: string; nama_kebutuhan: string; jumlah: number | null; tanggal: string }[]
  >([]);
  const [namaDivisi, setNamaDivisi] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const divisiId = profile.divisi_id;

  async function load() {
    if (!divisiId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchPengajuanDanaDetail(supabase, { divisiId });
      setItems(rows);

      const { data: divisi } = await supabase
        .from("divisi")
        .select("nama_divisi")
        .eq("id", divisiId)
        .maybeSingle();
      setNamaDivisi(divisi?.nama_divisi ?? "Divisi");

      // Kebutuhan yang bisa diajukan: sudah disetujui & belum ada pengajuannya.
      const { data: kebutuhan } = await supabase
        .from("kebutuhan")
        .select("id, nama_kebutuhan, jumlah, tanggal, status")
        .eq("divisi_id", divisiId)
        .eq("status", "disetujui")
        .order("tanggal", { ascending: false });

      const { data: pengajuans } = await supabase
        .from("pengajuan_dana")
        .select("kebutuhan_id")
        .eq("divisi_id", divisiId);
      const terpakai = new Set(
        (pengajuans ?? [])
          .map((p) => p.kebutuhan_id)
          .filter((v): v is string => Boolean(v))
      );

      setPilihanKebutuhan(
        (kebutuhan ?? [])
          .filter((k) => !terpakai.has(k.id))
          .map((k) => ({
            id: k.id,
            nama_kebutuhan: k.nama_kebutuhan,
            jumlah: k.jumlah,
            tanggal: k.tanggal,
          }))
      );
    } catch {
      error("Gagal memuat data pengajuan dana.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisiId]);

  function openAdd() {
    setForm({ ...emptyForm, tanggal_pengajuan: todayISO() });
    setErrors({});
    setOpen(true);
  }

  function handleKebutuhanChange(id: string) {
    const k = pilihanKebutuhan.find((p) => p.id === id);
    setForm({
      ...form,
      kebutuhan_id: id,
      keperluan: k ? k.nama_kebutuhan : form.keperluan,
    });
  }

  async function handleSave() {
    if (!divisiId) return;
    const e = validatePengajuanDana({
      divisi_id: divisiId,
      tanggal_pengajuan: form.tanggal_pengajuan,
      nominal: form.nominal === "" ? null : parseFloat(form.nominal),
      keperluan: form.keperluan,
    });
    if (!form.kebutuhan_id) e.kebutuhan_id = "Pilih kebutuhan yang didanai.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    const { error: insErr } = await supabase.from("pengajuan_dana").insert({
      // divisi_id sengaja diambil dari profil, bukan dari input user,
      // sehingga divisi tidak bisa mengajukan atas nama divisi lain.
      divisi_id: divisiId,
      user_id: profile.id,
      kebutuhan_id: form.kebutuhan_id,
      tanggal_pengajuan: form.tanggal_pengajuan,
      nominal: parseFloat(form.nominal),
      keperluan: form.keperluan.trim(),
    });

    setSaving(false);
    if (insErr) {
      error(
        insErr.code === "23505"
          ? "Kebutuhan ini sudah memiliki pengajuan dana."
          : "Gagal membuat pengajuan dana: " + insErr.message
      );
      return;
    }

    success("Pengajuan dana terkirim ke Bendahara.");
    setOpen(false);
    await load();
  }

  const total = useMemo(
    () => items.reduce((sum, p) => sum + p.nominal, 0),
    [items]
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Pengajuan Dana
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ajukan dana untuk kebutuhan {namaDivisi} yang sudah disetujui Bendahara
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            title="Pengajuan Dana"
            subtitle={`${namaDivisi} - daftar pengajuan dana`}
            filename="pengajuan-dana"
            disabled={items.length === 0}
            columns={[
              { header: "Tanggal", key: "tanggal", width: 14 },
              { header: "Kebutuhan", key: "kebutuhan", width: 30 },
              { header: "Keperluan", key: "keperluan", width: 28 },
              { header: "Nominal", key: "nominal", width: 16 },
              { header: "Persetujuan", key: "persetujuan", width: 14 },
              { header: "Pengambilan", key: "pengambilan", width: 14 },
            ]}
            rows={items.map((p) => ({
              tanggal: formatDate(p.tanggal_pengajuan),
              kebutuhan: p.nama_kebutuhan ?? "-",
              keperluan: p.keperluan,
              nominal: formatRupiah(p.nominal),
              persetujuan: STATUS_PERSETUJUAN_LABEL[p.status_persetujuan],
              pengambilan: STATUS_PENGAMBILAN_LABEL[p.status_pengambilan],
            }))}
          />
          <Button
            onClick={openAdd}
            disabled={pilihanKebutuhan.length === 0}
            title={
              pilihanKebutuhan.length === 0
                ? "Tidak ada kebutuhan berstatus \"Disetujui\" yang belum punya pengajuan"
                : "Buat pengajuan dana baru"
            }
          >
            <Plus className="h-4 w-4" />
            Ajukan Dana
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Pengajuan hanya bisa dibuat untuk kebutuhan yang sudah{" "}
          <strong>disetujui</strong> oleh Bendahara.
          {/* dan satu kebutuhan hanya
          boleh punya satu pengajuan. Status persetujuan &amp; pengambilan
          ditangani Bendahara. */}
        </p>
      </div>

      <Card>
        <CardHeader
          title="Riwayat Pengajuan"
          subtitle={`${items.length} pengajuan &middot; total ${formatRupiah(total)}`}
          icon={<HandCoins className="h-5 w-5" />}
        />
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState
              title="Belum ada pengajuan dana"
              description="Kebutuhan yang disetujui Bendahara bisa langsung mengajukan dana di sini."
            />
          ) : (
            <TableWrap minWidth={980}>
              <THead>
                <tr>
                  <TH>Tanggal</TH>
                  <TH>Kebutuhan</TH>
                  <TH>Keperluan</TH>
                  <TH align="right">Nominal</TH>
                  <TH>Persetujuan</TH>
                  <TH>Pengambilan</TH>
                </tr>
              </THead>
              <TBody>
                {items.map((p) => (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(p.tanggal_pengajuan)}
                    </TD>
                    <TD className="min-w-[10rem] text-sm font-medium text-slate-900 dark:text-white">
                      {p.nama_kebutuhan ?? "-"}
                    </TD>
                    <TD className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
                      <span className="safe-text block">{p.keperluan}</span>
                    </TD>
                    <TD align="right" className="whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {formatRupiah(p.nominal)}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Badge color={STATUS_PERSETUJUAN_COLOR[p.status_persetujuan]}>
                        {STATUS_PERSETUJUAN_LABEL[p.status_persetujuan]}
                      </Badge>
                      {p.approved_at && (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {formatDate(p.approved_at.slice(0, 10))}
                        </span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Badge color={STATUS_PENGAMBILAN_COLOR[p.status_pengambilan]}>
                        {STATUS_PENGAMBILAN_LABEL[p.status_pengambilan]}
                      </Badge>
                      {p.taken_at && (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {formatDate(p.taken_at.slice(0, 10))}
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajukan Dana">
        <div className="space-y-4">
          <Field
            label="Kebutuhan yang Didanai"
            error={errors.kebutuhan_id}
            hint="Hanya kebutuhan berstatus Disetujui yang bisa dipilih."
          >
            <select
              value={form.kebutuhan_id}
              onChange={(e) => handleKebutuhanChange(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Pilih kebutuhan</option>
              {pilihanKebutuhan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kebutuhan}
                  {k.jumlah != null ? ` (x${k.jumlah})` : ""} &middot;{" "}
                  {formatDate(k.tanggal)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal Pengajuan" error={errors.tanggal_pengajuan}>
            <Input
              type="date"
              value={form.tanggal_pengajuan}
              onChange={(e) =>
                setForm({ ...form, tanggal_pengajuan: e.target.value })
              }
            />
          </Field>
          <Field label="Nominal (Rp)" error={errors.nominal}>
            <Input
              type="number"
              min="0"
              value={form.nominal}
              onChange={(e) => setForm({ ...form, nominal: e.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="Keperluan" error={errors.keperluan}>
            <Textarea
              rows={3}
              value={form.keperluan}
              onChange={(e) => setForm({ ...form, keperluan: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Kirim Pengajuan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
