"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buktiFileName,
  classifyBukti,
  resolveBuktiUrl,
  withDownloadFlag,
} from "@/lib/bukti";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Eye, FileText, ImageOff, Loader2 } from "lucide-react";

/**
 * Indikator bukti pada tabel/list transaksi.
 * Tidak pernah menampilkan raw URL Supabase Storage sebagai teks.
 */
export function BuktiButton({
  buktiRef,
  onOpen,
}: {
  buktiRef: string | null | undefined;
  onOpen: (ref: string) => void;
}) {
  if (!buktiRef) {
    return (
      <span className="whitespace-nowrap text-xs font-medium text-slate-400 dark:text-slate-500">
        Tidak ada bukti
      </span>
    );
  }

  const isImage = classifyBukti(buktiRef) !== "file";

  return (
    <button
      type="button"
      onClick={() => onOpen(buktiRef)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs transition hover:bg-emerald-100 active:scale-[0.98] dark:border-emerald-500/25 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
    >
      {isImage ? <Eye className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
      <span>Lihat Bukti</span>
    </button>
  );
}

/** Status ringkas tanpa interaksi (untuk list/menu yang tidak bisa diklik). */
export function BuktiBadge({ buktiRef }: { buktiRef: string | null | undefined }) {
  if (!buktiRef) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400">
        Tidak ada bukti
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      Ada Bukti
    </span>
  );
}

/**
 * Modal preview bukti transaksi.
 * - Gambar: object-fit contain, tidak overflow, ada fallback bila gagal dimuat.
 * - File non-gambar: ditawarkan lewat tombol Unduh.
 */
export function BuktiPreviewModal({
  buktiRef,
  onClose,
}: {
  buktiRef: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!buktiRef) {
      setUrl(null);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    setUrl(null);

    resolveBuktiUrl(createClient(), buktiRef)
      .then((resolved) => {
        if (!active) return;
        setUrl(resolved);
        if (!resolved) setFailed(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [buktiRef]);

  const kind = buktiRef ? classifyBukti(buktiRef) : "file";
  const isImage = kind !== "file" && kind !== "path";
  const fileName = buktiFileName(buktiRef);

  return (
    <Modal open={Boolean(buktiRef)} onClose={onClose} title="Bukti Transaksi" size="lg">
      {buktiRef && (
        <div className="space-y-4">
          <div className="flex max-h-[62vh] min-h-[180px] items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                <p className="text-xs">Memuat bukti...</p>
              </div>
            ) : failed || !url ? (
              <BuktiFallback />
            ) : isImage ? (
              <img
                src={url}
                alt="Bukti Transaksi"
                onError={() => setFailed(true)}
                className="max-h-[58vh] max-w-full rounded-lg object-contain shadow-sm"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                  <FileText className="h-7 w-7 stroke-[1.5]" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Bukti tidak dapat ditampilkan langsung
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Format file ini bukan gambar. Gunakan tombol Unduh.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
              {fileName}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {url && (
                <a
                  href={withDownloadFlag(url, fileName)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-50 px-3.5 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-900/25 dark:text-brand-300 dark:hover:bg-brand-900/40"
                >
                  Unduh
                </a>
              )}
              <Button variant="outline" size="sm" onClick={onClose}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BuktiFallback() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-500/20">
        <ImageOff className="h-7 w-7 stroke-[1.5]" />
      </div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Bukti tidak dapat ditampilkan
      </p>
      <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        File bukti mungkin sudah tidak tersedia. Periksa koneksi Anda atau hubungi
        pengaju transaksi.
      </p>
    </div>
  );
}
