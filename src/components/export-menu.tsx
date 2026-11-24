"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownPanel } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import {
  downloadExport,
  type ApprovalSpec,
  type ExportColumn,
  type ExportFormat,
  type SummaryItem,
} from "@/lib/export-client";
import { DEFAULT_SCHOOL_KOP, type SchoolKop } from "@/lib/school-config";
import { usePeriode } from "@/lib/periode-context";
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
  /** KOP surat; default memakai identitas sekolah dari `school-config`. */
  kop?: SchoolKop;
  /** Orientasi cetak PDF: portrait, landscape, atau auto (default). */
  orientation?: "portrait" | "landscape" | "auto";
  /** Unit/divisi penghasil laporan; dikenali dari subtitle bila kosong. */
  division?: string;
  /** Jenis dokumen; dikenali dari judul bila kosong. */
  documentType?: string;
  /** Keterangan tambahan pada bagian KETERANGAN. */
  notes?: string[];
  /** Penyesuaian pihak pengesah untuk laporan khusus. */
  approval?: ApprovalSpec;
  /** Ringkasan tambahan yang dihitung aplikasi pemanggil. */
  extraSummary?: SummaryItem[];
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
    iconColor: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-900/20",
  },
  {
    key: "doc",
    label: "Word (DOCX)",
    hint: "Tabel dapat diedit di MS Word",
    icon: File,
    iconColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    key: "excel",
    label: "Excel (XLSX)",
    hint: "Spreadsheet & formula",
    icon: FileSpreadsheet,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
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
  kop = DEFAULT_SCHOOL_KOP,
  orientation,
  division,
  documentType,
  notes,
  approval,
  extraSummary,
}: ExportMenuProps) {
  const { success, error } = useToast();
  // Phase 11: setiap file export harus menyebut periode asalnya supaya
  // arsip antar periode tidak tertukar. Barisnya sendiri sudah otomatis
  // terfilter periode oleh period scope di supabase client.
  const { periodeId, allPeriodsMode, options } = usePeriode();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const periodeLabel = allPeriodsMode
    ? "Semua Periode"
    : options.find((p) => p.id === periodeId)?.namaPeriode ?? "Tanpa Periode";

  async function handleExport(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    setOpen(false);
    try {
      await downloadExport({
        format,
        title,
        // Periode selalu ikut tercetak di kop dokumen.
        subtitle: [subtitle, `Periode: ${periodeLabel}`]
          .filter(Boolean)
          .join(" · "),
        columns,
        rows,
        // KOP surat sekolah (bisa diganti lewat prop `kop`).
        kop,
        orientation,
        division,
        documentType,
        notes,
        approval,
        extraSummary,
        periodLabel: periodeLabel,
        // Nama file memuat periode agar tidak tertukar antar periode.
        filename: `${filename ?? title}-${periodeLabel.replace(/[^\w-]+/g, "-")}`,
      });
      success(`File ${format.toUpperCase()} "${title}" (${periodeLabel}) berhasil diunduh.`);
    } catch {
      error("Gagal membuat file export.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="relative" ref={anchorRef}>
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={disabled || Boolean(busy)}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="gap-2 rounded-[14px] font-medium"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-400" />
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
      </div>

      <DropdownPanel
        open={open}
        anchorRef={anchorRef}
        align="end"
        className="w-56"
        role="menu"
        ariaLabel="Pilih Format Ekspor"
        onClose={() => setOpen(false)}
        onEscape={() => {
          setOpen(false);
          anchorRef.current?.querySelector("button")?.focus();
        }}
      >
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
                role="menuitem"
                onClick={() => handleExport(f.key)}
                className="select-option gap-3"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${f.bgColor} ${f.iconColor}`}
                >
                  <IconComp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                    {f.label}
                  </p>
                  <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                    {f.hint}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DropdownPanel>
    </>
  );
}