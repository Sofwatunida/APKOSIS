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

/**
 * Status kebutuhan divisi.
 * Hanya Bendahara yang boleh mengubahnya (dijaga RLS + trigger database).
 */
export const STATUS_KEBUTUHAN = [
  "belum",
  "disetujui",
  "ditolak",
  "sudah_dipenuhi",
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

/** Baris kebutuhan pada form laporan harian divisi. */
export function validateKebutuhanRows(
  rows: { nama_kebutuhan: string; jumlah: string }[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  const adaIsi = rows.some(
    (r) => r.nama_kebutuhan.trim() || r.jumlah.trim() !== ""
  );
  if (!adaIsi) return errors;

  rows.forEach((r, i) => {
    if (!r.nama_kebutuhan.trim()) {
      errors[`kebutuhan_${i}`] = "Nama kebutuhan wajib diisi.";
      return;
    }
    if (r.jumlah !== "" && (isNaN(parseInt(r.jumlah)) || parseInt(r.jumlah) < 0)) {
      errors[`kebutuhan_${i}`] = "Jumlah harus >= 0.";
    }
  });
  return errors;
}

/** Form pengajuan dana (Admin Divisi / Bendahara). */
export function validatePengajuanDana(input: {
  divisi_id: string;
  tanggal_pengajuan: string;
  nominal: number | null;
  keperluan: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!required(input.divisi_id)) errors.divisi_id = "Divisi wajib dipilih.";
  if (!required(input.tanggal_pengajuan))
    errors.tanggal_pengajuan = "Tanggal pengajuan wajib diisi.";
  else if (!isValidDate(input.tanggal_pengajuan))
    errors.tanggal_pengajuan = "Tanggal pengajuan tidak valid.";
  if (input.nominal === null || isNaN(input.nominal))
    errors.nominal = "Nominal harus berupa angka.";
  else if (input.nominal <= 0) errors.nominal = "Nominal harus lebih dari 0.";
  if (!required(input.keperluan)) errors.keperluan = "Keperluan wajib diisi.";
  return errors;
}
