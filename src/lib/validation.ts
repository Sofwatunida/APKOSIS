export function required(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function isValidDate(value: string): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

export function isValidNominal(value: number | null | undefined): boolean {
  return typeof value === "number" && !isNaN(value) && value >= 0;
}

export function isValidJumlah(value: number | null | undefined): boolean {
  return typeof value === "number" && !isNaN(value) && value >= 0;
}

export const KONDISI_INVENTARIS = [
  "baik",
  "rusak_ringan",
  "rusak_berat",
  "hilang",
] as const;

export const STATUS_PEMBELIAN = [
  "belum_dibeli",
  "sudah_dibeli",
  "tidak_dibeli",
] as const;

export const JENIS_TRANSAKSI = ["pemasukan", "pengeluaran"] as const;

export function validateLaporan(input: {
  tanggal: string;
  kegiatan_hari_ini: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!required(input.tanggal)) errors.tanggal = "Tanggal wajib diisi.";
  else if (!isValidDate(input.tanggal)) errors.tanggal = "Tanggal tidak valid.";
  if (!required(input.kegiatan_hari_ini))
    errors.kegiatan_hari_ini = "Kegiatan hari ini wajib diisi.";
  return errors;
}

export function validateTransaksi(input: {
  tanggal: string;
  jenis_transaksi: string;
  keterangan: string;
  nominal: number | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!required(input.tanggal)) errors.tanggal = "Tanggal wajib diisi.";
  else if (!isValidDate(input.tanggal)) errors.tanggal = "Tanggal tidak valid.";
  if (!["pemasukan", "pengeluaran"].includes(input.jenis_transaksi))
    errors.jenis_transaksi = "Jenis transaksi tidak valid.";
  if (!required(input.keterangan))
    errors.keterangan = "Keterangan wajib diisi.";
  if (!isValidNominal(input.nominal)) errors.nominal = "Nominal harus >= 0.";
  return errors;
}
