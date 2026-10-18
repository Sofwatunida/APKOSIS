/**
 * Identitas sekolah untuk KOP dokumen ekspor (PDF / Word / Excel).
 *
 * Nilai di bawah BISA dikonfigurasi satu kali di sini (atau dihubungkan
 * ke tabel `system_settings` bila tersedia). Bila sebuah field kosong,
 * barisnya otomatis tidak dicetak — jadi KOP tetap rapi walau belum
 * lengkap.
 *
 * Cara mengganti: ubah nilai di `DEFAULT_SCHOOL_KOP`, atau oper `kop`
 * khusus lewat prop `kop` pada `<ExportMenu>`.
 */

export interface SchoolKop {
  /** Nama besar pada KOP, mis. "SMA NEGERI 1 CONTOH". */
  namaSekolah: string;
  /** Baris alamat di bawah nama. */
  alamat?: string;
  /** Baris kontak (telepon / email / website). */
  kontak?: string;
  /** Kata kunci dokumen, mis. "OSIS" — opsional. */
  substansi?: string;
}

export const DEFAULT_SCHOOL_KOP: SchoolKop = {
  namaSekolah: "SMA NEGERI 1 CONTOH",
  alamat: "Jl. Pendidikan No. 123, Kota, Provinsi",
  kontak: "Telp. (021) 000-0000 · email@sekolah.sch.id · www.sekolah.sch.id",
  substansi: "OSIS",
};
