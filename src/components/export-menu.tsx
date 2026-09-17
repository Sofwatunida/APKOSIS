"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  downloadExport,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/export-client";

interface ExportMenuProps {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  filename?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

const FORMATS: { key: ExportFormat; label: string; hint: string }[] = [
  { key: "pdf", label: "PDF", hint: "Dokumen PDF" },
  { key: "doc", label: "DOC", hint: "Dokumen Word" },
  { key: "excel", label: "Excel", hint: "File spreadsheet" },
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
      await downloadExport({ format, title, subtitle, columns, rows, filename: filename ?? title });
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
        className="whitespace-nowrap"
      >
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700" />
            {busy.toUpperCase()}
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
              />
            </svg>
            Export
            <svg
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Pilih Format
          </p>
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => handleExport(f.key)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <span className="font-medium">{f.label}</span>
              <span className="text-[11px] text-slate-400">{f.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}