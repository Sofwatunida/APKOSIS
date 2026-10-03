/**
 * Konstanta sistem periode.
 *
 * Periode yang sedang dipilih disimpan di cookie supaya bisa dibaca
 * oleh Server Component (query database) maupun Client Component
 * (dropdown + query PostgREST) tanpa perlu parameter tambahan.
 */

export const PERIOD_COOKIE = "apkosis_periode";

/** Nilai khusus Super Admin untuk melihat seluruh periode sekaligus. */
export const ALL_PERIODS_VALUE = "semua-periode";

/**
 * Cookie kosong berarti "pakai periode aktif". Nilai sentinel ini
 * hanya dipakai sesaat supaya query tidak pernah menjadi unscoped;
 * angka aslinya diresolve dari tabel `periods` sebelum query jalan.
 */
export const ACTIVE_PERIOD_SENTINEL = "__periode_aktif__";

export const PERIOD_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Tabel yang WAJIB selalu difilter berdasarkan periode. */
export const PERIOD_SCOPED_TABLES = [
  "laporan_harian",
  "kendala_solusi",
  "transaksi_keuangan",
  "saldo_awal",
  "kebutuhan",
  "pengajuan_dana",
  "inventaris",
  "program_kerja",
  "anggota_divisi",
  "opsi_kegiatan",
] as const;

export type PeriodScopedTable = (typeof PERIOD_SCOPED_TABLES)[number];

const PERIOD_SCOPED = new Set<string>(PERIOD_SCOPED_TABLES);

export function isPeriodScopedTable(table: string): boolean {
  return PERIOD_SCOPED.has(table);
}

export const PERIOD_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  archived: "Arsip",
  inactive: "Belum Aktif",
};