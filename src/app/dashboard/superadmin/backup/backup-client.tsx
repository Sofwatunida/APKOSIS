"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { resetPeriodeDataAction, restoreBackupAction } from "../../actions/periode-actions";
import type { PeriodOption } from "./page";

const BACKUP_TABLES = [
  "divisi",
  "laporan_harian",
  "transaksi_keuangan",
  "inventaris",
  "kendala_solusi",
  "program_kerja",
] as const;

type BackupPayload = {
  meta: Record<string, unknown>;
  divisi: Record<string, unknown>[];
  laporan_harian: Record<string, unknown>[];
  transaksi_keuangan: Record<string, unknown>[];
  inventaris: Record<string, unknown>[];
  kendala_solusi: Record<string, unknown>[];
  program_kerja: Record<string, unknown>[];
};

async function fetchBackup(periodeId: string): Promise<BackupPayload> {
  const supabase = createClient();

  const [divisi, laporan, trx, inv, kendala, program] = await Promise.all([
    supabase.from("divisi").select("id, nomor_divisi, nama_divisi").order("nomor_divisi"),
    supabase
      .from("laporan_harian")
      .select("id, divisi_id, periode_id, tanggal, kegiatan_hari_ini, informasi_lain, penerima_laporan, created_at")
      .eq("periode_id", periodeId),
    supabase
      .from("transaksi_keuangan")
      .select("id, divisi_id, periode_id, tanggal, jenis_transaksi, sumber_pemasukan, digunakan_untuk, keterangan, nominal, created_at")
      .eq("periode_id", periodeId),
    supabase
      .from("inventaris")
      .select("id, divisi_id, periode_id, nama_barang, jumlah, kondisi, keterangan")
      .eq("periode_id", periodeId),
    supabase
      .from("kendala_solusi")
      .select("id, laporan_id, periode_id, kendala, solusi")
      .eq("periode_id", periodeId),
    supabase
      .from("program_kerja")
      .select("id, divisi_id, periode_id, nama_program, deskripsi, file_name")
      .eq("periode_id", periodeId),
  ]);

  const firstError =
    divisi.error ?? laporan.error ?? trx.error ?? inv.error ?? kendala.error ?? program.error;
  if (firstError) throw new Error(firstError.message);

  return {
    meta: {},
    divisi: (divisi.data ?? []) as Record<string, unknown>[],
    laporan_harian: (laporan.data ?? []) as Record<string, unknown>[],
    transaksi_keuangan: (trx.data ?? []) as Record<string, unknown>[],
    inventaris: (inv.data ?? []) as Record<string, unknown>[],
    kendala_solusi: (kendala.data ?? []) as Record<string, unknown>[],
    program_kerja: (program.data ?? []) as Record<string, unknown>[],
  };
}

function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BackupClient({ periods }: { periods: PeriodOption[] }) {
  const { success, error } = useToast();
  const [periodeId, setPeriodeId] = useState(periods[0]?.id ?? "");
  const periodeNama =
    periods.find((p) => p.id === periodeId)?.namaPeriode ?? "(tanpa periode)";

  // ---- Backup ----
  const [backuping, setBackuping] = useState(false);

  async function handleBackup() {
    if (!periodeId) {
      error("Pilih periode yang akan dibackup.");
      return;
    }
    setBackuping(true);
    try {
      const data = await fetchBackup(periodeId);
      const payload = {
        ...data,
        meta: {
          app: "APKOSIS",
          formatVersion: 1,
          generatedAt: new Date().toISOString(),
          periodeId,
          periodeNama,
          counts: BACKUP_TABLES.reduce<Record<string, number>>((acc, t) => {
            acc[t] = (data[t] as unknown[]).length;
            return acc;
          }, {}),
        },
      };
      downloadJson(payload, `backup-apkosis-${periodeNama.replace(/[^\w-]+/g, "-")}`);
      success("Backup berhasil diunduh.");
    } catch (e) {
      error(e instanceof Error ? e.message : "Backup gagal.");
    } finally {
      setBackuping(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Backup Data"
          subtitle="Unduh salinan JSON data satu periode (tanpa password). Aman disimpan sebagai arsip."
          icon={<DatabaseBackup className="h-5 w-5" />}
        />
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Periode">
              <Select value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPeriode}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button onClick={handleBackup} disabled={backuping || !periodeId} className="gap-2">
                {backuping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span>{backuping ? "Menyiapkan..." : "Unduh Backup JSON"}</span>
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tabel yang disertakan: {BACKUP_TABLES.join(", ")}. Kata sandi divisi TIDAK pernah
            disertakan dalam backup.
          </p>
        </CardContent>
      </Card>

      <RestoreSection periodeId={periodeId} periodeNama={periodeNama} />
      <ResetSection periods={periods} periodeId={periodeId} setPeriodeId={setPeriodeId} />
    </div>
  );
}

function RestoreSection({
  periodeId,
  periodeNama,
}: {
  periodeId: string;
  periodeNama: string;
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [payloadText, setPayloadText] = useState("");
  const [preview, setPreview] = useState<{ label: string; count: number }[] | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setPayloadText("");
    file
      .text()
      .then((txt) => {
        const obj = JSON.parse(txt) as BackupPayload;
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
          throw new Error("Struktur file tidak valid.");
        }
        setPayloadText(txt);
        setPreview(
          BACKUP_TABLES.map((t) => ({
            label: t.replace(/_/g, " "),
            count: Array.isArray(obj[t]) ? (obj[t] as unknown[]).length : 0,
          }))
        );
      })
      .catch((e) => {
        setFileName("");
        error(e instanceof Error ? e.message : "File tidak bisa dibaca.");
      });
  }

  function applyRestore() {
    if (!payloadText) return;
    const fd = new FormData();
    fd.set("payload", payloadText);
    startTransition(async () => {
      const result = await restoreBackupAction(fd);
      if (result.ok) success(result.message);
      else error(result.message);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Pemulihan (Restore)"
        subtitle="Muat file backup JSON, periksa isinya, lalu pulihkan. Data existing tidak ditimpa (hanya baris baru ditambahkan)."
        icon={<Upload className="h-5 w-5" />}
      />
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="File backup (.json)">
            <Input
              type="file"
              accept="application/json,.json"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={!preview}
              onClick={() =>
                downloadJson(
                  { meta: { kind: "pre-restore", periodeId, periodeNama, generatedAt: new Date().toISOString() } },
                  `backup-pra-pemulihan-${periodeNama.replace(/[^\w-]+/g, "-")}`
                )
              }
            >
              <Download className="h-4 w-4" />
              <span>Backup Pra-Pemulihan</span>
            </Button>
            <Button
              className="gap-2"
              disabled={!payloadText || pending}
              onClick={applyRestore}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{pending ? "Memulihkan..." : "Pulihkan"}</span>
            </Button>
          </div>
        </div>

        {fileName && (
          <div className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <DatabaseBackup className="h-4 w-4" /> {fileName}
            </p>
            {preview ? (
              <ul className="grid gap-1 sm:grid-cols-2">
                {preview.map((p) => (
                  <li key={p.label} className="text-xs text-muted-foreground">
                    {p.label}: <span className="font-semibold text-foreground">{p.count}</span> baris
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-rose-600">File tidak valid.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResetSection({
  periods,
  periodeId,
  setPeriodeId,
}: {
  periods: PeriodOption[];
  periodeId: string;
  setPeriodeId: (v: string) => void;
}) {
  const { success, error } = useToast();
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const periodeNama = periods.find((p) => p.id === periodeId)?.namaPeriode ?? "";
  const expected = useMemo(() => `RESET ${periodeNama}`.trim(), [periodeNama]);
  const canReset = confirmText.trim() === expected && !!periodeId && !pending;

  function execute() {
    const fd = new FormData();
    fd.set("periode_id", periodeId);
    startTransition(async () => {
      const result = await resetPeriodeDataAction(fd);
      if (result.ok) success(result.message);
      else error(result.message);
      setStep(1);
      setConfirmText("");
    });
  }

  return (
    <Card className="border-rose-300 dark:border-rose-500/30">
      <CardHeader
        title="Reset Data Operasional Periode"
        subtitle="Menghapus laporan, keuangan, kendala, inventaris, kebutuhan, dan opsi kegiatan untuk satu periode. Akun, divisi, dan program kerja TIDAK dihapus."
        icon={<ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
      />
      <CardContent>
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Periode yang akan direset">
              <Select value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPeriode}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                variant="danger"
                className="gap-2"
                disabled={!periodeId}
                onClick={() => setStep(2)}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Lanjut Reset...</span>
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-rose-300">
              <p className="mb-1 font-semibold">Tindakan ini tidak bisa dibatalkan.</p>
              <p>
                Semua data operasional periode <b>{periodeNama}</b> akan dihapus permanen.
                Untuk melanjutkan, ketik <b className="select-all">{expected}</b> di kolom
                berikut.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Ketik "${expected}" untuk mengonfirmasi`}>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expected}
                  autoComplete="off"
                />
              </Field>
              <div className="flex items-end gap-2">
                <Button variant="danger" disabled={!canReset} onClick={execute}>
                  {pending ? "Mereset..." : "Ya, Reset Sekarang"}
                </Button>
                <Button variant="secondary" disabled={pending} onClick={() => setStep(1)}>
                  Batal
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
