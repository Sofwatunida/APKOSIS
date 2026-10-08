import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Kebutuhan, KebutuhanStatus } from "./types";

/**
 * ==========================================================
 * LOGIC KEBUTUHAN DIVISI
 * ==========================================================
 * Satu tabel `kebutuhan` dipakai bersama oleh dua pihak:
 *   - ROLE DIVISI  : membuat kebutuhan dari halaman "Kebutuhan Divisi",
 *                    hanya bisa MELIHAT status.
 *   - ROLE BENDAHARA: membaca semua kebutuhan + mengubah `status`.
 *
 * Status memakai satu sumber kebenaran di kolom `kebutuhan.status`:
 *   belum          -> "Belum Diproses"
 *   disetujui      -> "Disetujui"
 *   ditolak        -> "Ditolak"
 *   sudah_dipenuhi-> "Sudah Dipenuhi"
 *
 * Mengubah `status` TIDAK bisa dilakukan role Divisi:
 *   - RLS  : policy UPDATE milik Divisi hanya untuk divisinya sendiri,
 *            sedangkan nilai `status` dikunci oleh trigger
 *            `guard_kebutuhan_status()` (hanya Bendahara).
 */

export const STATUS_KEBUTUHAN: KebutuhanStatus[] = [
  "belum",
  "disetujui",
  "ditolak",
  "sudah_dipenuhi",
];

export const STATUS_KEBUTUHAN_LABEL: Record<KebutuhanStatus, string> = {
  belum: "Belum Diproses",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  sudah_dipenuhi: "Sudah Dipenuhi",
};

/** Warna badge mengikuti komponen `Badge` yang sudah dipakai project. */
export const STATUS_KEBUTUHAN_COLOR: Record<
  KebutuhanStatus,
  "amber" | "blue" | "red" | "green"
> = {
  belum: "amber",
  disetujui: "blue",
  ditolak: "red",
  sudah_dipenuhi: "green",
};

/** Kebutuhan baru = belum disentuh Bendahara. */
export function isKebutuhanBaru(status: KebutuhanStatus): boolean {
  return status === "belum";
}

/** Kebutuhan yang sudah dipenuhi (barang sudah dibeli/disediakan). */
export function isKebutuhanTerpenuhi(status: KebutuhanStatus): boolean {
  return status === "sudah_dipenuhi";
}

/**
 * Data kebutuhan yang sudah dilengkapi dengan nama relasinya
 * (nama divisi, nama pelapor, tanggal laporan).
 */
export interface KebutuhanDetail extends Kebutuhan {
  nama_divisi: string;
  pelapor: string;
  /** Tanggal efektif: tanggal laporan bila ada, else tanggal input. */
  tanggal_efektif: string;
  /** Cuplikan kegiatan laporan terkait (bila ada). */
  kegiatan_laporan: string | null;
}

/**
 * Mengambil kebutuhan + mengisi nama divisi, nama pelapor, dan tanggal.
 *
 * Relasi diambil lewat query terpisah (bukan nested select) supaya:
 *   1. mudah dibaca & dipelajari,
 *   2. tidak/Ambiguous ketika satu tabel punya beberapa foreign key.
 *
 * Catatan RLS: nama pelapor diambil dari `anggota_divisi` (ketua/wakil divisi).
 * Policy `anggota_divisi` sudah dibuka untuk Bendahara di migration 007.
 */
export async function fetchKebutuhanDetail(
  supabase: SupabaseClient<Database>,
  options: { divisiId?: string | null } = {}
): Promise<KebutuhanDetail[]> {
  let query = supabase
    .from("kebutuhan")
    .select("id, divisi_id, laporan_id, nama_kebutuhan, jumlah, keterangan, status, tanggal, created_by, created_at, updated_at")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.divisiId) query = query.eq("divisi_id", options.divisiId);

  const { data: kebutuhan, error } = await query;
  if (error) throw error;

  const rows = (kebutuhan ?? []) as Kebutuhan[];
  if (rows.length === 0) return [];

  // 1. Nama divisi
  const { data: divisiList } = await supabase
    .from("divisi")
    .select("id, nama_divisi");
  const namaDivisi = new Map(
    (divisiList ?? []).map((d) => [d.id, d.nama_divisi])
  );

  // 2. Data laporan terkait (tanggal + pelapor + kegiatan)
  const laporanIds = [
    ...new Set(rows.map((r) => r.laporan_id).filter((v): v is string => Boolean(v))),
  ];
  const laporanMap = new Map<
    string,
    { tanggal: string; pelapor_id: string | null; kegiatan: string }
  >();
  if (laporanIds.length > 0) {
    const { data: laporanList } = await supabase
      .from("laporan_harian")
      .select("id, tanggal, pelapor_id, kegiatan_hari_ini")
      .in("id", laporanIds);
    (laporanList ?? []).forEach((l) => {
      laporanMap.set(l.id, {
        tanggal: l.tanggal,
        pelapor_id: l.pelapor_id,
        kegiatan: l.kegiatan_hari_ini,
      });
    });
  }

  // 3. Nama pelapor (ketua/wakil) dari anggota_divisi
  const pelaporIds = [
    ...new Set(
      [...laporanMap.values()]
        .map((l) => l.pelapor_id)
        .filter((v): v is string => Boolean(v))
    ),
  ];
  const namaAnggota = new Map<string, string>();
  if (pelaporIds.length > 0) {
    const { data: anggota } = await supabase
      .from("anggota_divisi")
      .select("id, nama")
      .in("id", pelaporIds);
    (anggota ?? []).forEach((a) => namaAnggota.set(a.id, a.nama));
  }

  // 4. Nama akun pembuat (dipakai bila kebutuhan tidak berasal dari laporan)
  const dibuatOleh = [
    ...new Set(rows.map((r) => r.created_by).filter((v): v is string => Boolean(v))),
  ];
  const namaProfil = new Map<string, string>();
  if (dibuatOleh.length > 0) {
    const { data: profil } = await supabase
      .from("profiles")
      .select("id, nama, email")
      .in("id", dibuatOleh);
    (profil ?? []).forEach((p) => {
      namaProfil.set(p.id, p.nama || p.email || "Tanpa nama");
    });
  }

  return rows.map((row) => {
    const laporan = row.laporan_id ? laporanMap.get(row.laporan_id) : undefined;
    const namaPelapor = laporan?.pelapor_id
      ? namaAnggota.get(laporan.pelapor_id)
      : undefined;
    return {
      ...row,
      nama_divisi: namaDivisi.get(row.divisi_id) ?? "Divisi tidak ditemukan",
      pelapor: namaPelapor ?? namaProfil.get(row.created_by ?? "") ?? "-",
      tanggal_efektif: laporan?.tanggal ?? row.tanggal,
      kegiatan_laporan: laporan?.kegiatan ?? null,
    };
  });
}
