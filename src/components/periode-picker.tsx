"use client";

import { usePeriode, ALL_PERIODS_VALUE, PERIOD_STATUS_LABELS } from "@/lib/periode-context";
import { Select } from "@/components/ui/form";
import { CalendarRange } from "lucide-react";

/**
 * Dropdown periode. Satu-satunya tempat user memilih periode,
 * dipakai di seluruh halaman supaya tidak ada daftar tahun
 * hardcoded di masing-masing fitur.
 */
export function PeriodePicker({ canSelectAllPeriods = false }: { canSelectAllPeriods?: boolean }) {
  const { periodeId, allPeriodsMode, options, changePeriode } = usePeriode();

  if (options.length === 0) return null;

  const currentValue = allPeriodsMode ? ALL_PERIODS_VALUE : (periodeId ?? "");

  return (
    <Select
      aria-label="Pilih periode"
      value={currentValue}
      onChange={(e) => changePeriode(e.target.value)}
      wrapperClassName="w-auto"
      className="w-auto py-2 pl-8 pr-9 text-xs font-semibold"
      leftIcon={<CalendarRange className="h-4 w-4" />}
    >
      {canSelectAllPeriods && (
        <option value={ALL_PERIODS_VALUE}>Semua Periode</option>
      )}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.namaPeriode} ({PERIOD_STATUS_LABELS[o.status]})
        </option>
      ))}
    </Select>
  );
}