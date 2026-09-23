"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  downloadExport,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/export-client";
import {
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  File,
  Loader2,
} from "lucide-react";

interface ExportMenuProps {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  filename?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

const FORMATS: {
  key: ExportFormat;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
}[] = [
  {
    key: "pdf",
    label: "PDF",
    hint: "Dokumen cetak resmi",
    icon: FileText,
    iconColor: "text-rose-600",
    bgColor: "bg-rose-50",
  },
  {
    key: "doc",
    label: "Word (DOC)",
    hint: "Dapat diedit di MS Word",
    icon: File,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    key: "excel",
    label: "Excel (XLSX)",
    hint: "Spreadsheet & formula",
    icon: FileSpreadsheet,
    iconColor: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
];

export function ExportMenu({
  title,
  subtitle,
  columns,
  rows,
  filename,
  disabled,
  size = "sm",
}: ExportMenuProps) {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function handleExport(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    setOpen(false);
    try {
      await downloadExport({
        format,
        title,
        subtitle,
        columns,
        rows,
        filename: filename ?? title,
      });
      success(`File ${format.toUpperCase()} "${title}" berhasil diunduh.`);
    } catch {
      error("Gagal membuat file export.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={disabled || Boolean(busy)}
        onClick={() => setOpen((o) => !o)}
        className="gap-2 font-medium"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            <span>Mengekspor {busy.toUpperCase()}...</span>
          </>
        ) : (
          <>
            <Download className="h-4 w-4 text-slate-500" />
            <span>Ekspor</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-elevated backdrop-blur-md animate-slide-up">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Pilih Format Ekspor
          </p>
          <div className="space-y-0.5">
            {FORMATS.map((f) => {
              const IconComp = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleExport(f.key)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${f.bgColor} ${f.iconColor}`}
                  >
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{f.label}</p>
                    <p className="text-[11px] text-slate-400">{f.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}