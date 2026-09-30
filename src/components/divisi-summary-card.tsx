"use client";

import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import { ArrowRight } from "lucide-react";

export interface DivisiSummary {
  id: string;
  nama: string;
  masuk: number;
  keluar: number;
}

/**
 * Kartu ringkasan keuangan per divisi yang bisa diklik untuk membuka
 * halaman "Detail Keuangan". Dipakai di Rekap Keuangan (Monitoring/Sekretaris)
 * supaya angka pada rekap selalu bisa ditelusuri ke transaksi aslinya.
 */
export function DivisiSummaryCard({
  divisi,
  periode,
}: {
  divisi: DivisiSummary;
  periode: string;
}) {
  const saldo = divisi.masuk - divisi.keluar;
  const href = `/dashboard/detail-keuangan?divisi=${encodeURIComponent(
    divisi.id
  )}&periode=${encodeURIComponent(periode)}`;

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">
          {divisi.nama}
        </h4>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600" />
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Pemasukan</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {formatRupiah(divisi.masuk)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Pengeluaran</span>
          <span className="font-medium text-red-600">{formatRupiah(divisi.keluar)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-1 text-xs dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Saldo</span>
          <span
            className={`font-bold ${
              saldo >= 0
                ? "text-brand-600 dark:text-brand-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatRupiah(saldo)}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400">
        Lihat detail transaksi &rarr;
      </p>
    </Link>
  );
}
