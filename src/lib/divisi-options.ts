/**
 * Opsi dropdown DIVISI untuk fitur keuangan.
 *
 * Setiap dropdown divisi pada fitur keuangan wajib memuat
 * "Semua Divisi" lalu "Divisi 01" .. "Divisi 20" (lihat poin
 * permintaan keuangan). Daftar ini disusun dari tabel `divisi`
 * (data asli), dilengkapi nomor yang tidak ada di database
 * supaya daftar tetap lengkap.
 *
 * Nomor yang hilang memakai uuid sinar (00000000-...-0000000000NN)
 * yang tidak pernah cocok dengan `divisi_id` mana pun, sehingga
 * saat dipilih yang tampil adalah data asli yaitu nol — bukan data
 * dummy.
 */

/** Jumlah divisi baku hasil seed (Divisi 01 .. Divisi 20). */
export const JUMLAH_DIVISI_BAKU = 20;

export interface DivisiOption {
  /** uuid baris `divisi`, atau uuid sinar bila nomor tidak ada di database. */
  id: string;
  /** Label dropdown: "Divisi 07" atau "Divisi 07 — <nama asli bila berbeda>". */
  nama: string;
  /** Nomor divisi, dipakai untuk pengurutan. */
  nomor: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function labelFor(nomor: number, nama: string | null | undefined): string {
  const baku = `Divisi ${pad2(nomor)}`;
  const clean = (nama ?? "").trim();
  if (!clean || clean === baku) return baku;
  return `${baku} — ${clean}`;
}

/**
 * Susun opsi dropdown divisi dari baris tabel `divisi`.
 *
 * @param rows hasil query `select("id, nomor_divisi, nama_divisi")`
 *             yang sudah diurutkan `nomor_divisi`.
 * @returns daftar berurutan 1..20 (+ baris database di luar nomor baku).
 */
export function buildDivisiOptions(
  rows:
    | {
        id: string;
        nomor_divisi?: number | null;
        nama_divisi?: string | null;
      }[]
    | null
    | undefined
): DivisiOption[] {
  const list: DivisiOption[] = [];
  const seen = new Set<number>();

  for (const r of rows ?? []) {
    const nomor = typeof r.nomor_divisi === "number" ? r.nomor_divisi : null;
    if (nomor === null) {
      // Baris tanpa nomor: tetap ikut tampil, diurutkan paling belakang.
      const nama = (r.nama_divisi ?? "").trim() || "-";
      list.push({ id: r.id, nomor: Number.MAX_SAFE_INTEGER, nama });
      continue;
    }
    if (seen.has(nomor)) continue; // nomor unik; baris pertama menang
    seen.add(nomor);
    list.push({ id: r.id, nomor, nama: labelFor(nomor, r.nama_divisi) });
  }

  // Lengkapi nomor baku yang tidak ada di database.
  for (let n = 1; n <= JUMLAH_DIVISI_BAKU; n++) {
    if (seen.has(n)) continue;
    list.push({
      id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
      nomor: n,
      nama: `Divisi ${pad2(n)}`,
    });
  }

  return list.sort((a, b) => a.nomor - b.nomor || a.nama.localeCompare(b.nama));
}
