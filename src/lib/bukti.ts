import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bucket penyimpanan bukti transaksi (lihat migration bukti_struk_bucket).
 * Bucket ini public, namun kode di bawah tetap menangani kemungkinan bucket
 * private / path relatif agar tidak menampilkan broken image.
 */
export const BUKTI_BUCKET = "bukti-struk";

/** Ekstensi gambar yang officially didukung untuk preview bukti. */
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|svg)(\?|#|$)/i;

const BUKTI_TAG = /\[BUKTI:([^\]]+)\]/g;

export interface ParsedBukti {
  /** Keterangan tanpa jejak bukti / tanpa raw URL. */
  cleanKeterangan: string;
  /** Referensi file bukti apa adanya (bisa URL, storage path, atau data URL). */
  buktiRef: string | null;
}

/**
 * Memisahkan field `keterangan` menjadi teks bersih + referensi bukti.
 * Fungsi ini murni (tidak menyentuh jaringan) sehingga aman dipakai di
 * semua role dan di semua halaman.
 */
export function parseBukti(raw: string | null | undefined): ParsedBukti {
  if (!raw) return { cleanKeterangan: "", buktiRef: null };

  const refs: string[] = [];
  const clean = raw.replace(BUKTI_TAG, (_m, ref: string) => {
    const trimmed = ref.trim();
    if (trimmed) refs.push(trimmed);
    return " ";
  });

  return {
    cleanKeterangan: clean.replace(/\s{2,}/g, " ").trim(),
    buktiRef: refs.length > 0 ? refs[0] : null,
  };
}

/** Membuang seluruh markup [BUKTI:...] dari teks (untuk export & pencarian). */
export function stripBukti(raw: string | null | undefined): string {
  return parseBukti(raw).cleanKeterangan;
}

export type BuktiKind = "image" | "file" | "data" | "remote" | "path";

export function classifyBukti(ref: string): BuktiKind {
  if (ref.startsWith("data:")) return "data";
  if (/^https?:\/\//i.test(ref)) return "remote";
  if (IMAGE_EXT.test(ref)) return "image";
  return "file";
}

/**
 * Mengubah referensi bukti menjadi URL yang bisa dirender.
 *
 * Menangani 3 bentuk data yang ada di database:
 *  1. Data URL (fallback ketika upload gagal) -> dipakai langsung.
 *  2. URL absolut (public URL Supabase) -> dipakai langsung.
 *  3. Storage path relatif, mis. `bukti/<divisi>/<file>.jpg` -> diubah via
 *     Supabase Storage. Dicoba public URL lebih dulu; jika bucket ternyata
 *     private / file tidak ada, dicoba signed URL.
 *
 * Nilai null berarti bukti tidak bisa ditampilkan, namun tetap ada fallback UI
 * di komponen (bukan broken image).
 */
export async function resolveBuktiUrl(
  supabase: SupabaseClient,
  ref: string | null | undefined
): Promise<string | null> {
  const value = (ref ?? "").trim();
  if (!value) return null;

  if (value.startsWith("data:")) return value;
  if (/^https?:\/\//i.test(value)) return value;

  // Sisanya dianggap storage path di dalam bucket bukti.
  const path = value.replace(/^\/+/, "").replace(/^\/+/, "");
  if (!path) return null;

  const { data } = supabase.storage.from(BUKTI_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (publicUrl) {
    const { data: signed, error } = await supabase.storage
      .from(BUKTI_BUCKET)
      .createSignedUrl(path, 60 * 30);
    // Bucket public: public URL langsung bisa dipakai. Signed URL hanya
    // dipakai sebagai cadangan bila public URL tidak tersedia.
    if (error || !signed?.signedUrl) return publicUrl;
    return publicUrl || signed.signedUrl;
  }

  const { data: fallback } = await supabase.storage
    .from(BUKTI_BUCKET)
    .createSignedUrl(path, 60 * 30);
  return fallback?.signedUrl ?? null;
}

/** Nama file yang aman untuk judul / unduhan. */
export function buktiFileName(ref: string | null | undefined, fallback = "bukti-transaksi") {
  if (!ref) return fallback;
  if (ref.startsWith("data:")) return fallback;
  const clean = ref.split(/[?#]/)[0];
  const parts = clean.split("/");
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? decodeURIComponent(last) : fallback;
}

/** Membangun query string (?download=1) untuk link unduh. */
export function withDownloadFlag(url: string, name: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=1&filename=${encodeURIComponent(name)}`;
}
