/**
 * Identitas resmi organisasi untuk KOP dokumen ekspor (PDF / DOCX / XLSX).
 *
 * Nilai dapat dikonfigurasi administrator lewat environment variable
 * NEXT_PUBLIC_OSIS_* (dibaca saat build) atau langsung di `DEFAULT_SCHOOL_KOP`.
 * Teks dalam tanda kurung siku adalah PLACEHOLDER, bukan identitas fiktif:
 * administrator wajib menggantinya sebelum dokumen digunakan sebagai arsip resmi.
 */

export interface SchoolKop {
  /** Nama organisasi yang dicetak paling atas. */
  organization?: string;
  /** Nama sekolah. */
  namaSekolah: string;
  /** Baris alamat di bawah nama sekolah. */
  alamat?: string;
  /** Baris kontak (telepon / email / website). Kosongkan bila tidak ada. */
  kontak?: string;
  /** Kata kunci dokumen, mis. "OSIS". */
  substansi?: string;
  /** URL logo sekolah. Kosongkan bila belum tersedia; tidak ada logo fiktif. */
  logoUrl?: string;
  /** Nama penjabat yang dapat diisi pada ruang pengesahan. */
  ketuaOsis?: string;
  ketuaDivisi?: string;
  pembinaOsis?: string;
  bendaharaOsis?: string;
  sekretarisOsis?: string;
}

function configured(name: string, fallback: string): string {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export const DEFAULT_SCHOOL_KOP: SchoolKop = {
  organization: configured(
    "NEXT_PUBLIC_OSIS_ORGANIZATION",
    "ORGANISASI SISWA INTRA SEKOLAH (OSIS)"
  ),
  namaSekolah: configured("NEXT_PUBLIC_OSIS_SCHOOL_NAME", "[NAMA SEKOLAH]"),
  alamat: configured("NEXT_PUBLIC_OSIS_SCHOOL_ADDRESS", "[ALAMAT SEKOLAH]"),
  kontak: configured("NEXT_PUBLIC_OSIS_SCHOOL_CONTACT", ""),
  substansi: configured("NEXT_PUBLIC_OSIS_SUBSTANCE", "OSIS"),
  logoUrl: configured("NEXT_PUBLIC_OSIS_LOGO_URL", ""),
  ketuaOsis: configured("NEXT_PUBLIC_OSIS_KETUA", "[NAMA KETUA OSIS]"),
  ketuaDivisi: configured("NEXT_PUBLIC_OSIS_KETUA_DIVISI", "[NAMA KETUA DIVISI]"),
  pembinaOsis: configured("NEXT_PUBLIC_OSIS_PEMBINA", "[NAMA PEMBINA OSIS]"),
  bendaharaOsis: configured("NEXT_PUBLIC_OSIS_BENDAHARA", "[NAMA BENDAHARA OSIS]"),
  sekretarisOsis: configured("NEXT_PUBLIC_OSIS_SEKRETARIS", "[NAMA SEKRETARIS OSIS]"),
};
