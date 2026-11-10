import { LoaderCircle } from "lucide-react";

/**
 * Loading UI untuk konten halaman saja.
 *
 * Sidebar, header, dan provider sekarang berada di `dashboard/layout.tsx`
 * dan tetap terpasang saat navigasi, jadi skeleton shell tidak boleh
 * diulang di sini.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        <LoaderCircle
          className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-400"
          aria-hidden="true"
        />
        Memuat halaman...
      </div>

      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>

      <div
        aria-hidden="true"
        className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      />
    </div>
  );
}
