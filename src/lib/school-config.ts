/**
 * Identitas sekolah untuk KOP dokumen ekspor (PDF / Word / Excel).
 *
 * Isi hanya dengan identitas sekolah yang benar. Field kosong tidak akan
 * dicetak, sehingga ekspor tidak menampilkan alamat atau kontak contoh.
 *
 * Cara mengganti: ubah nilai di `DEFAULT_SCHOOL_KOP`, atau oper `kop`
 * khusus lewat prop `kop` pada `<ExportMenu>`.
 */

export interface SchoolKop {
  /** Nama sekolah yang dicetak pada KOP. */
  namaSekolah: string;
  /** Baris alamat di bawah nama. */
  alamat?: string;
  /** Baris kontak (telepon / email / website). */
  kontak?: string;
  /** Kata kunci dokumen, mis. "OSIS" — opsional. */
  substansi?: string;
}

export const DEFAULT_SCHOOL_KOP: SchoolKop = {
  namaSekolah: "",
};
