"use client";

import { usePeriode, ALL_PERIODS_VALUE, PERIOD_STATUS_LABELS } from "@/lib/periode-context";
import { AlertTriangle, CalendarRange, ChevronDown, Layers } from "lucide-react";

/**
 * Dropdown periode. Satu-satunya tempat user memilih periode,
 * dipakai di seluruh halaman supaya tidak ada daftar tahun
 * hardcoded di masing-masing fitur.
 */
export function PeriodePicker({ canSelectAllPeriods = false }: { canSelectAllPeriods?: boolean }) {
  const { periodeId, allPeriodsMode, options, readOnly, changePeriode } = usePeriode();

  if (options.length === 0) return null;

  const currentValue = allPeriodsMode ? ALL_PERIODS_VALUE : (periodeId ?? "");
  const current = options.find((o) => o.id === currentValue);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select
          aria-label="Pilih periode"
          value={currentValue}
          onChange={(e) => changePeriode(e.target.value)}
          className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {canSelectAllPeriods && (
            <option value={ALL_PERIODS_VALUE}>Semua Periode</option>
          )}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.namaPeriode} ({PERIOD_STATUS_LABELS[o.status]})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {allPeriodsMode ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
          <Layers className="h-3 w-3" />
          Semua periode
        </span>
      ) : readOnly ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Sedang melihat arsip {current?.namaPeriode}
        </span>
      ) : (
        <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline dark:bg-emerald-900/20 dark:text-emerald-300">
          Periode Aktif: {current?.namaPeriode}
        </span>
      )}
    </div>
  );
}