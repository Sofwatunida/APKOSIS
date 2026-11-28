"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatDivisiLabel } from "@/lib/divisi-options";
import {
  DIVISI_PASSWORD_MAX_LENGTH,
  DIVISI_PASSWORD_MIN_LENGTH,
} from "@/lib/division-password";
import { saveDivisionPasswordAction } from "./actions";

export interface DivisiPasswordRow {
  id: string;
  nomorDivisi: number;
  namaDivisi: string;
  hasPassword: boolean;
  updatedAt: string | null;
}

function label(nomor: number, nama: string): string {
  return formatDivisiLabel(nomor, nama);
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

export function PasswordDivisiClient({
  divisi,
  periodeId,
  readOnly = false,
}: {
  divisi: DivisiPasswordRow[];
  periodeId?: string;
  readOnly?: boolean;
}) {
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
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const visible = useMemo(() => {
    if (!debounced) return divisi;
    return divisi.filter((d) =>
      label(d.nomorDivisi, d.namaDivisi).toLowerCase().includes(debounced)
    );
  }, [debounced, divisi]);

  function mintaKonfirmasi(row: DivisiPasswordRow) {
    const value = values[row.id] ?? "";

    if (readOnly) {
      setRowError((prev) => ({
        ...prev,
        [row.id]: "Periode ini sudah diarsipkan, kredensial tidak bisa diubah.",
      }));
      return;
    }

    if (!value) {
      setRowError((prev) => ({ ...prev, [row.id]: "Password divisi belum diisi." }));
      return;
    }
    if (value.length < DIVISI_PASSWORD_MIN_LENGTH) {
      setRowError((prev) => ({
        ...prev,
        [row.id]: `Password divisi minimal ${DIVISI_PASSWORD_MIN_LENGTH} karakter.`,
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

    try {
      const result = await saveDivisionPasswordAction(row.id, value, periodeId);

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
      success(`Password ${label(row.nomorDivisi, row.namaDivisi)} berhasil diperbarui.`);
    } finally {
      setSavingId(null);
    }
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
    <div className="space-y-6">
      <PageHeader title="Pengaturan Password Divisi" />

      {readOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Periode ini sudah diarsipkan. Kredensial divisi periode berikutnya
          diatur terpisah dan password lama tetap berlaku untuk arsipnya.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs dark:border-slate-800/80 dark:bg-slate-900/60">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {sudahDiatur} / {divisi.length}{" "}divisi sudah punya password
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {divisi.length - sudahDiatur}{" "}belum punya password
        </span>
      </div>

      <Card>
        <CardHeader
          title="Daftar Divisi"
          icon={<KeyRound className="h-4 w-4" />}
        />
        <CardContent>
          <div className="relative mb-4 w-full max-w-none sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama divisi..."
              aria-label="Cari divisi"
              className="pl-9"
            />
          </div>
          {divisi.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Belum ada data divisi.
            </p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Tidak ada divisi yang cocok dengan pencarian.
            </p>
          ) : (
            <ul className="space-y-4">
              {visible.map((row) => {
                const meta = status[row.id] ?? row;
                const value = values[row.id] ?? "";
                const isRevealed = Boolean(revealed[row.id]);
                const isSaving = savingId === row.id;
                const waktu = formatWaktu(meta.updatedAt);
                const error = rowError[row.id];

                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/40 sm:p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h4 className="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-white">
                        {label(row.nomorDivisi, row.namaDivisi)}
                      </h4>
                      {meta.hasPassword ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Sudah diatur
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Belum diatur
                        </span>
                      )}
                    </div>

                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        mintaKonfirmasi(meta);
                      }}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <div className="relative min-w-0 flex-1">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                            <KeyRound className="h-4 w-4" />
                          </div>
                          <input
                            type={isRevealed ? "text" : "password"}
                            value={value}
                            maxLength={DIVISI_PASSWORD_MAX_LENGTH}
                            autoComplete="new-password"
                            spellCheck={false}
                            aria-label={`Password baru ${label(row.nomorDivisi, row.namaDivisi)}`}
                            placeholder="Password baru"
                            onChange={(e) => {
                              setValues((prev) => ({ ...prev, [row.id]: e.target.value }));
                              setRowError((prev) => ({ ...prev, [row.id]: "" }));
                              setBaruDisimpan((prev) =>
                                prev === row.id ? null : prev
                              );
                            }}
                            className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-brand-500 dark:focus:ring-brand-500/10"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setRevealed((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                            }
                            className="tap-target absolute inset-y-0 right-0 flex h-full w-10 items-center justify-center text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                            aria-label={
                              isRevealed
                                ? `Sembunyikan password ${label(row.nomorDivisi, row.namaDivisi)}`
                                : `Tampilkan password ${label(row.nomorDivisi, row.namaDivisi)}`
                            }
                          >
                            {isRevealed ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            className="h-10 w-full px-3.5 text-sm sm:w-auto"
                            disabled={isSaving}
                          >
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
                              size="sm"
                              className="h-10 w-10 px-0"
                              onClick={() => bersihkanNilai(meta)}
                              title="Kosongkan kolom password"
                              aria-label={`Kosongkan kolom password ${label(row.nomorDivisi, row.namaDivisi)}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {waktu && (
                        <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                          Terakhir diperbarui: {waktu}
                        </p>
                      )}

                      {error && (
                        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                          {error}
                        </p>
                      )}

                      {baruDisimpan === row.id && (
                        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            Password yang baru saja Anda tentukan masih terlihat di kolom
                            ini agar bisa disalin. Nilai ini berasal dari yang Anda
                            ketik, bukan dibaca dari database. Tekan ikon tong untuk
                            mengosongkannya.
                          </span>
                        </p>
                      )}
                    </form>
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
                ? `Apakah Anda yakin ingin mengubah password ${label(pending.nomorDivisi, pending.namaDivisi)}?`
                : `Apakah Anda yakin ingin membuat password untuk ${label(pending.nomorDivisi, pending.namaDivisi)}?`}
            </p>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {status[pending.id]?.hasPassword
                  ? `Password lama ${label(pending.nomorDivisi, pending.namaDivisi)} langsung tidak berlaku setelah disimpan.`
                  : `Setelah dibuat, hanya Anda yang mengetahui password ${label(pending.nomorDivisi, pending.namaDivisi)}. Berikan langsung kepada user divisi.`}
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
