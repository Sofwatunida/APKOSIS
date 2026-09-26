import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export type StatTone = "brand" | "green" | "red" | "amber" | "indigo" | "slate";

const TONES: Record<StatTone, { value: string; iconBg: string }> = {
  brand: {
    value: "text-brand-600 dark:text-brand-400",
    iconBg: "bg-brand-50 text-brand-600 ring-brand-500/10 dark:bg-brand-900/25 dark:text-brand-400",
  },
  green: {
    value: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 text-emerald-600 ring-emerald-500/10 dark:bg-emerald-900/25 dark:text-emerald-400",
  },
  red: {
    value: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-50 text-rose-600 ring-rose-500/10 dark:bg-rose-900/25 dark:text-rose-400",
  },
  amber: {
    value: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 text-amber-600 ring-amber-500/10 dark:bg-amber-900/25 dark:text-amber-400",
  },
  indigo: {
    value: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-50 text-indigo-600 ring-indigo-500/10 dark:bg-indigo-900/25 dark:text-indigo-400",
  },
  slate: {
    value: "text-slate-700 dark:text-slate-200",
    iconBg: "bg-slate-100 text-slate-500 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400",
  },
};

/**
 * Kartu statistik yang dipakai bersama oleh semua role agar tampilan
 * dashboard, ringkasan keuangan, dan halaman lain konsisten.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "brand",
  icon,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
  icon?: ReactNode;
  className?: string;
}) {
  const current = TONES[tone] ?? TONES.brand;

  return (
    <Card className={`transition-all duration-200 hover:shadow-card dark:hover:shadow-elevated ${className}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase leading-relaxed tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {icon && (
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${current.iconBg}`}
            >
              {icon}
            </div>
          )}
        </div>
        <p className={`safe-text mt-3 text-2xl font-bold leading-tight tracking-tight ${current.value}`}>
          {value}
        </p>
        {sub && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}
