"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { saveDivisionPasswordAction } from "./actions";

export interface DivisiPasswordRow {
  id: string;
  nomorDivisi: number;
  namaDivisi: string;
  hasPassword: boolean;
  updatedAt: string | null;
}

const MIN_PASSWORD_LENGTH = 4;

function label(nomor: number): string {
  return `Divisi ${String(nomor).padStart(2, "0")}`;
}

function formatWaktu(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function PasswordDivisiClient({ divisi }: { divisi: DivisiPasswordRow[] }) {
  const { success, error: toastError } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, DivisiPasswordRow>>(
    () => Object.fromEntries(divisi.map((d) => [d.id, d]))
  );
  const [pending, setPending] = useState<DivisiPasswordRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [baruDisimpan, setBaruDisimpan] = useState<string | null>(null);

  function mintaKonfirmasi(row: DivisiPasswordRow) {
    const value = values[row.id] ?? "";

    if (!value) {
      setRowError((prev) => ({ ...prev, [row.id]: "Password divisi belum diisi." }));
      return;
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
      setRowError((prev) => ({
        ...prev,
        [row.id]: `Password divisi minimal ${MIN_PASSWORD_LENGTH} karakter.`,
      }));
      return;
    }

    setRowError((prev) => ({ ...prev, [row.id]: "" }));
    setPending(row);
  }

  async function konfirmasiSimpan() {
    if (!pending) return;

    const row = pending;
    const value = values[row.id] ?? "";
    if (!value) return;

    setSavingId(row.id);

    const result = await saveDivisionPasswordAction(row.id, value);

    setSavingId(null);

    if (!result.ok) {
      setPending(null);
      setRowError((prev) => ({ ...prev, [row.id]: result.message ?? "Gagal menyimpan." }));
      toastError(result.message ?? "Gagal menyimpan password divisi.");
      return;
    }

    setStatus((prev) => ({
      ...prev,
      [row.id]: {
        ...row,
        hasPassword: true,
        updatedAt: result.updatedAt ?? new Date().toISOString(),
      },
    }));
    setBaruDisimpan(row.id);
    setPending(null);
    success(`Password ${label(row.nomorDivisi)} berhasil diperbarui.`);
  }

  function batalSimpan() {
    if (savingId) return;
    setPending(null);
  }

  function bersihkanNilai(row: DivisiPasswordRow) {
    setValues((prev) => ({ ...prev, [row.id]: "" }));
    setRevealed((prev) => ({ ...prev, [row.id]: false }));
    setRowError((prev) => ({ ...prev, [row.id]: "" }));
    setBaruDisimpan((prev) => (prev === row.id ? null : prev));
  }

  const sudahDiatur = Object.values(status).filter((d) => d.hasPassword).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengaturan Password Divisi"
        description="Anda yang menentukan password setiap divisi. Password di-hash (bcrypt) di server sebelum disimpan dan tidak pernah ditampilkan kembali."
      />

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs dark:border-slate-800/80 dark:bg-slate-900/60">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {sudahDiatur} / {divisi.length} divisi sudah punya password
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {divisi.length - sudahDiatur} belum punya password
        </span>
      </div>

      <Card>
        <CardHeader
          title="Daftar Divisi"
          subtitle="Isi password baru lalu tekan Simpan. Password yang sudah tersimpan tidak bisa dibaca kembali — catat atau bagikan langsung kepada=user divisi."
          icon={<KeyRound className="h-4 w-4" />}
        />
        <CardContent>
          {divisi.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Belum ada data divisi.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
              {divisi.map((row) => {
                const meta = status[row.id] ?? row;
                const value = values[row.id] ?? "";
                const isRevealed = Boolean(revealed[row.id]);
                const isSaving = savingId === row.id;
                const waktu = formatWaktu(meta.updatedAt);
                const error = rowError[row.id];

                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:gap-5"
                  >
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:justify-start">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {label(row.nomorDivisi)}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {row.namaDivisi}
                        </p>
                      </div>
                      {meta.hasPassword ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Sudah diatur
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Belum diatur
                        </span>
                      )}
                    </div>

                    <form
                      className="flex flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:flex-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        mintaKonfirmasi(meta);
                      }}
                    >
                      <div className="relative flex-1 lg:min-w-72">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <KeyRound className="h-4 w-4" />
                        </div>
                        <input
                          type={isRevealed ? "text" : "password"}
                          value={value}
                          maxLength={128}
                          autoComplete="new-password"
                          spellCheck={false}
                          aria-label={`Password baru ${label(row.nomorDivisi)}`}
                          placeholder="Password baru"
                          onChange={(e) => {
                            setValues((prev) => ({ ...prev, [row.id]: e.target.value }));
                            setRowError((prev) => ({ ...prev, [row.id]: "" }));
                            setBaruDisimpan((prev) =>
                              prev === row.id ? null : prev
                            );
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-brand-500 dark:focus:ring-brand-500/10"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setRevealed((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                          }
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                          aria-label={
                            isRevealed
                              ? `Sembunyikan password ${label(row.nomorDivisi)}`
                              : `Tampilkan password ${label(row.nomorDivisi)}`
                          }
                        >
                          {isRevealed ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button type="submit" size="md" disabled={isSaving}>
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          <span>Simpan</span>
                        </Button>
                        {(value || baruDisimpan === row.id) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => bersihkanNilai(meta)}
                            title="Kosongkan kolom password"
                            aria-label={`Kosongkan kolom password ${label(row.nomorDivisi)}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </form>

                    {error && (
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        {error}
                      </p>
                    )}

                    {baruDisimpan === row.id && (
                      <p className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          Password yang baru saja Anda tentukan masih terlihat di kolom
                          ini agar bisa disalin. Nilai ini berasal dari yang Anda
                          ketik, bukan dibaca dari database. Tekan ikon tong untuk
                          mengosongkannya.
                        </span>
                      </p>
                    )}

                    {waktu && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Terakhir diperbarui: {waktu}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(pending)}
        onClose={batalSimpan}
        title="Konfirmasi Password Divisi"
        size="sm"
      >
        {pending && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {status[pending.id]?.hasPassword
                ? `Apakah Anda yakin ingin mengubah password ${label(pending.nomorDivisi)}?`
                : `Apakah Anda yakin ingin membuat password untuk ${label(pending.nomorDivisi)}?`}
            </p>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {status[pending.id]?.hasPassword
                  ? `Password lama ${label(pending.nomorDivisi)} langsung tidak berlaku setelah disimpan.`
                  : `Setelah dibuat, hanya Anda yang mengetahui password ${label(pending.nomorDivisi)}. Berikan langsung kepada user divisi.`}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={batalSimpan} disabled={Boolean(savingId)}>
                Batal
              </Button>
              <Button
                onClick={konfirmasiSimpan}
                loading={savingId === pending.id}
              >
                Simpan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
