/** Nilai standar opsi "Semua Divisi" pada seluruh filter divisi APKOSIS. */
export const SEMUA_DIVISI_VALUE = "";
export const SEMUA_DIVISI_LABEL = "Semua Divisi";

/**
 * Opsi dropdown DIVISI standar APKOSIS.
 *
 * Opsi pertama selalu "Semua Divisi" dengan nilai UUID kosong, lalu
 * seluruh divisi asli dari tabel `divisi` diurutkan berdasarkan nomor.
 * Tidak ada entri statis/sintetis: nilai selain UUID asli tidak pernah
 * dikirim sebagai filter database.
 */
export interface DivisiOption {
  id: string;
  nama: string;
  nomor: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isSemuaDivisi(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === SEMUA_DIVISI_VALUE.toLowerCase() ||
    normalized === "all" ||
    normalized === "semua" ||
    normalized === "seluruh" ||
    normalized === SEMUA_DIVISI_LABEL.toLowerCase() ||
    normalized === "seluruh divisi"
  );
}

export function getDivisiFilterLabel(
  divisiId: string | null | undefined,
  options: {
    id: string;
    nama?: string;
    nama_divisi?: string;
    namaDivisi?: string;
  }[]
): string {
  if (isSemuaDivisi(divisiId)) return SEMUA_DIVISI_LABEL;
  const match = options.find((d) => d.id === divisiId);
  return match?.nama ?? match?.nama_divisi ?? match?.namaDivisi ?? SEMUA_DIVISI_LABEL;
}

/** Format tampilan divisi: cukup nama divisinya saja (tanpa nomor/sufiks). */
export function formatDivisiLabel(
  nomor: number | null | undefined,
  nama: string | null | undefined
): string {
  const clean = (nama ?? "")
    .trim()
    .replace(/^divisi\s*\d+\s*/i, "")
    .trim()
    .toUpperCase();
  if (clean) return clean;
  if (typeof nomor === "number") return `Divisi ${pad2(nomor)}`;
  return "DIVISI";
}

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
  const list: DivisiOption[] = [
    { id: SEMUA_DIVISI_VALUE, nama: SEMUA_DIVISI_LABEL, nomor: 0 },
  ];
  const seenIds = new Set<string>();

  for (const r of rows ?? []) {
    if (!r.id || seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    const nomor = typeof r.nomor_divisi === "number" ? r.nomor_divisi : null;
    list.push({
      id: r.id,
      nomor: nomor ?? Number.MAX_SAFE_INTEGER,
      nama: formatDivisiLabel(nomor, r.nama_divisi || "-"),
    });
  }

  return list.sort((a, b) => a.nomor - b.nomor || a.nama.localeCompare(b.nama));
}
