/**
 * Helper lintas-format untuk dokumen administrasi resmi OSIS.
 * Dipakai oleh PDF, DOCX, dan XLSX supaya kop, ringkasan, pengesahan,
 * dan footer identik di semua format ekspor.
 */

import type { SchoolKop } from "./school-config";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right" | "center";
  /** Agregasi ringkasan. Bila kosong, kolom numerik dikenali otomatis. */
  summarize?: "sum" | "count";
  /** Format angka pada ringkasan. */
  format?: "currency" | "number";
}

export interface ApprovalSignatory {
  label: string;
  name: string;
}

export interface ApprovalSpec {
  heading?: string;
  signatories: ApprovalSignatory[];
}

export interface SummaryItem {
  label: string;
  value: string;
}

export type ExportFormat = "pdf" | "doc" | "excel";
export type ExportOrientation = "portrait" | "landscape" | "auto";

export interface ExportInput {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  filename: string;
  kop?: SchoolKop;
  orientation?: ExportOrientation;
  /** Unit/divisi penghasil laporan. */
  division?: string;
  /** Label periode kepengurusan (dikirim ExportMenu). */
  periodLabel?: string;
  /** Jenis dokumen, mis. LAPORAN / REKAPITULASI. Diidentifikasi otomatis bila kosong. */
  documentType?: string;
  /** Keterangan tambahan; baris subtitle asli tetap dipertahankan. */
  notes?: string[];
  /** Timpa tanda tangan default sesuai kewenangan laporan. */
  approval?: ApprovalSpec;
  /** Ringkasan tambahan hasil perhitungan aplikasi pemanggil. */
  extraSummary?: SummaryItem[];
  /** Data URL JPEG logo, sudah dinormalisasi oleh export-client. */
  logo?: LogoImage;
  /** Logo kiri/kanan kop surat resmi. */
  kopLogos?: KopLogos;
}

export interface LogoImage {
  dataUrl: string;
  width: number;
  height: number;
  mimeType?: "image/png" | "image/jpeg";
}

export interface KopLogos {
  left?: LogoImage;
  right?: LogoImage;
}

export const DEFAULT_KOP_LOGOS = {
  left: "/logo_osis.png",
  right: "/logo_tamir.png",
} as const;

export interface KopLine {
  text: string;
  size: number;
  bold: boolean;
  color: "navy" | "text" | "muted";
}

/** Palet resmi dokumen administrasi OSIS. */
export const DOCUMENT_PALETTE = {
  navy: "#17365D",
  blue: "#2F5597",
  lightBlue: "#EEF3F8",
  white: "#FFFFFF",
  border: "#B8C7D8",
  text: "#263445",
  muted: "#5F7183",
} as const;

export const DOCUMENT_RGB = {
  navy: [0.09, 0.212, 0.365] as [number, number, number],
  blue: [0.184, 0.333, 0.592] as [number, number, number],
  lightBlue: [0.933, 0.953, 0.973] as [number, number, number],
  white: [1, 1, 1] as [number, number, number],
  border: [0.722, 0.78, 0.847] as [number, number, number],
  text: [0.149, 0.204, 0.271] as [number, number, number],
  muted: [0.373, 0.443, 0.514] as [number, number, number],
};

export const DOCUMENT_ARGB = {
  navy: "FF17365D",
  blue: "FF2F5597",
  lightBlue: "FFEEF3F8",
  white: "FFFFFFFF",
  border: "FFB8C7D8",
  text: "FF263445",
  muted: "FF5F7183",
  zebra: "FFF7FAFD",
};

export function todayLabel(date: Date = new Date()): string {
  const tanggal = date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const jam = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${tanggal}, ${jam}`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Kop surat resmi OSIS/IP4A untuk seluruh dokumen ekspor. */
export function kopLines(_kop?: SchoolKop): KopLine[] {
  return [
    { text: "LAPORAN HARIAN", size: 16, bold: true, color: "navy" },
    { text: "PENGURUS DIVISI", size: 12, bold: true, color: "navy" },
    { text: "IKATAN PELAJAR PUTRI PONDOK PESANTREN AL-ITTIHAD", size: 11, bold: true, color: "navy" },
    { text: "(IP4A)", size: 11, bold: true, color: "navy" },
    { text: "MASA KHIDMAT 2026–2027", size: 10.5, bold: true, color: "navy" },
  ];
}

export function footerIdentity(_kop?: SchoolKop): string {
  return "IP4A Pondok Pesantren Al-Ittihad";
}

/** Jenis dokumen ditentukan dari judul, bukan diasumsikan sama untuk semua laporan. */
export function resolveDocumentType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("pengajuan")) return "PENGAJUAN DANA";
  if (t.includes("rekapitulasi") || t.includes("rekap")) return "REKAPITULASI";
  if (t.includes("log aktivitas") || t.includes("pengelolaan akun")) return "DOKUMEN ADMINISTRASI SISTEM";
  if (t.includes("laporan")) return "LAPORAN";
  if (t.includes("inventaris") || t.includes("kebutuhan") || t.includes("anggota"))
    return "DAFTAR DATA";
  return "DOKUMEN ORGANISASI";
}

/** Divisi/unit diambil dari subtitle asli bila pemanggil tidak mengirim prop khusus. */
export function resolveDivision(subtitle?: string, title?: string): string {
  const raw = (subtitle ?? "")
    .split("·")
    .map((s) => s.trim())
    .filter((s) => s && !/^periode\s*:/i.test(s) && !/^per\s+\d/i.test(s));
  for (const part of raw) {
    const match = part.match(/^divisi\s*:\s*(.+)$/i);
    if (match) return match[1].trim();
  }
  const joined = raw.join(" ");
  if (/seluruh divisi|semua divisi/i.test(joined)) return "Seluruh Divisi";
  if (title) {
    const match = title.match(/^(.+?)\s+-\s+(daftar|rekap|periode)/i);
    if (match) return match[1].trim();
  }
  return raw[0] || "Seluruh Divisi";
}

/**
 * Pengesahan mengikuti kewenangan jenis laporan.
 * Nama diambil dari konfigurasi organisasi; placeholder tidak dianggap data fiktif.
 */
export function resolveApproval(
  title: string,
  kop?: SchoolKop,
  override?: ApprovalSpec
): ApprovalSpec {
  if (override?.signatories?.length) return override;
  const t = title.toLowerCase();
  const ketua = kop?.ketuaOsis?.trim() || "[NAMA KETUA OSIS]";
  const pembina = kop?.pembinaOsis?.trim() || "[NAMA PEMBINA OSIS]";
  const bendahara = kop?.bendaharaOsis?.trim() || "[NAMA BENDAHARA OSIS]";
  const sekretaris = kop?.sekretarisOsis?.trim() || "[NAMA SEKRETARIS OSIS]";
  const ketuaDivisi = kop?.ketuaDivisi?.trim() || "[NAMA KETUA DIVISI]";
  const admin = "[NAMA ADMIN SISTEM]";

  if (t.includes("pengajuan dana")) {
    return {
      heading: "PENGESAHAN PENGAJUAN DANA",
      signatories: [
        { label: "Diajukan oleh,\nKetua Divisi", name: ketuaDivisi },
        { label: "Diperiksa oleh,\nBendahara OSIS", name: bendahara },
        { label: "Mengetahui,\nKetua OSIS", name: ketua },
      ],
    };
  }
  if (
    t.includes("keuangan") ||
    t.includes("transaksi") ||
    t.includes("saldo") ||
    t.includes("rekap bulanan")
  ) {
    return {
      heading: "PENGESAHAN LAPORAN KEUANGAN",
      signatories: [
        { label: "Disusun oleh,\nBendahara OSIS", name: bendahara },
        { label: "Mengetahui,\nKetua OSIS", name: ketua },
      ],
    };
  }
  if (t.includes("log aktivitas") || t.includes("pengelolaan akun") || t.includes("audit")) {
    return {
      heading: "PENGESAHAN DOKUMEN ADMINISTRASI",
      signatories: [
        { label: "Diverifikasi oleh,\nAdmin Sistem", name: admin },
        { label: "Mengetahui,\nKetua OSIS", name: ketua },
      ],
    };
  }
  if (
    t.includes("rekap") ||
    t.includes("monitoring") ||
    t.includes("data divisi") ||
    t.includes("periode kepengurusan")
  ) {
    return {
      heading: "PENGESAHAN REKAPITULASI",
      signatories: [
        { label: "Disusun oleh,\nSekretaris OSIS", name: sekretaris },
        { label: "Mengetahui,\nKetua OSIS", name: ketua },
        { label: "Mengetahui,\nPembina OSIS", name: pembina },
      ],
    };
  }
  return {
    heading: "PENGESAHAN LAPORAN",
    signatories: [
      { label: "Diajukan oleh,\nKetua Divisi", name: ketuaDivisi },
      { label: "Mengetahui,\nKetua OSIS", name: ketua },
    ],
  };
}

/** Parser angka dari teks Rupiah / format Indonesia; mengembalikan null bukan angka. */
export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let s = value.trim();
  if (!s || s === "-") return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/^\(|\)$/g, "").replace(/^[+-]/, "");
  s = s.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  s = s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (s.includes(",")) s = s.replace(/,/g, ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("id-ID");
}

export function formatCurrency(value: number): string {
  return `Rp ${formatNumber(Math.round(value))}`;
}

const AUTO_SUM_KEYS = [
  "nominal", "jumlah", "pemasukan", "pengeluaran", "saldo", "saldoawal",
  "dana", "inventaris", "program", "laporan", "kendala", "anggota",
];

/**
 * Ringkasan selalu dihitung dari baris data yang sebenarnya dikirim pemanggil.
 * Baris __total tidak dijumlahkan ulang agar tidak dobel hitung.
 */
export function computeSummary(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  extra: SummaryItem[] = []
): SummaryItem[] {
  const dataRows = rows.filter((r) => !r.__total);
  const items: SummaryItem[] = [
    { label: "Jumlah data", value: `${formatNumber(dataRows.length)} entri` },
  ];

  columns.forEach((column) => {
    const key = column.key.toLowerCase();
    const wanted = column.summarize === "sum" || column.summarize === "count";
    const auto = !column.summarize && AUTO_SUM_KEYS.some((k) => key.includes(k));
    if (!wanted && !auto) return;

    if (column.summarize === "count") {
      const count = dataRows.filter((r) => {
        const v = r[column.key];
        return v !== null && v !== undefined && String(v).trim() !== "";
      }).length;
      items.push({ label: `Jumlah ${column.header}`, value: `${formatNumber(count)} entri` });
      return;
    }

    const values = dataRows
      .map((r) => parseNumeric(r[column.key]))
      .filter((n): n is number => n !== null);
    if (values.length === 0) return;
    const total = values.reduce((a, b) => a + b, 0);
    const isCurrency =
      column.format === "currency" ||
      dataRows.some((r) => /rp\b/i.test(String(r[column.key] ?? "")));
    items.push({
      label: `Total ${column.header}`,
      value: isCurrency ? formatCurrency(total) : formatNumber(total),
    });
  });

  rows.filter((r) => r.__total).forEach((row) => {
    const label = String(row[columns[0]?.key ?? ""] ?? "Total").trim() || "Total";
    const numericColumn = columns.find((c) => parseNumeric(row[c.key]) !== null);
    if (!numericColumn) return;
    const n = parseNumeric(row[numericColumn.key]) ?? 0;
    items.push({
      label,
      value: /rp\b/i.test(String(row[numericColumn.key])) ? formatCurrency(n) : formatNumber(n),
    });
  });

  extra.forEach((item) => {
    if (item?.label && item?.value) items.push(item);
  });

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    })
    .slice(0, 7);
}

/** Teks normal dipakai ulang di tiga format agar tidak ada perbedaan isi. */
export function reportMetaRows(input: ExportInput, periodLabel: string): [string, string][] {
  return [
    ["Unit / Divisi", input.division?.trim() || resolveDivision(input.subtitle, input.title)],
    ["Periode Kepengurusan", periodLabel],
    ["Jenis Dokumen", input.documentType || resolveDocumentType(input.title)],
    ["Tanggal Pencetakan", todayLabel()],
  ];
}

export function reportNotes(input: ExportInput): string[] {
  const notes: string[] = [];
  if (input.subtitle?.trim()) notes.push(input.subtitle.trim());
  if (input.notes?.length) input.notes.forEach((n) => n.trim() && notes.push(n.trim()));
  if (notes.length === 0)
    notes.push("Data bersumber langsung dari basis data APKOSIS sesuai filter yang diterapkan.");
  return notes;
}
