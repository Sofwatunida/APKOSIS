"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Jam realtime (WIB) di header, diletakkan dekat dropdown periode.
 * Hanya menampilkan waktu; tidak mempengaruhi perilaku periode/manapun.
 */
export function RealtimeClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Set langsung saat mount supaya tidak ada teks "stale" dari render awal.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // WIB = UTC+7. Pakai komponen time supaya hasilnya konsisten di semua zona.
  const time = now
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      }).format(now)
    : "--:--:--";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/90 px-2.5 py-1 text-xs tabular-nums text-slate-600 shadow-xs dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400 ${className}`}
      title="Waktu Indonesia Barat (WIB)"
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
      <span className="font-semibold text-slate-800 dark:text-slate-200">{time}</span>
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">WIB</span>
    </div>
  );
}
