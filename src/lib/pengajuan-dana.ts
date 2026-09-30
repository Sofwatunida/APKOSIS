import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type {
  PengajuanDana,
  StatusPersetujuan,
  StatusPengambilan,
} from "./types";

/**
 * ==========================================================
 * LOGIC PENGAJUAN DANA
 * ==========================================================
 * Alur (sesuai role yang sudah ada di APKOSIS):
 *
 *   ROLE ADMIN (Admin Divisi)  -> membuat pengajuan (status awal "belum")
 *   ROLE BENDAHARA             -> melihat semua + menyetujui
 *   ROLE BENDAHARA             -> menandai uang sudah diambil
 *   ROLE DIVISI                -> hanya melihat status
 *
 * KEAMANAN STATUS:
 *   - Policy RLS "Pengajuan: update bendahara" berarti HANYA Bendahara yang
 *     punya hak UPDATE di database.
 *   - Trigger `guard_pengajuan_dana()` mengunci aturan:
 *       * uang tidak bisa "sudah_diambil" sebelum "disetujui",
 *       * approved_at / approved_by / taken_at / taken_by dicatat otomatis,
 *       * kalau dibatalkan persetujuannya, status pengambilan ikut reset.
 *   - Frontend TIDAK menjadi satu-satunya pengaman; aturan juga ada di DB.
 *
 * HUBUNGAN DENGAN KEBUTUHAN DIVISI:
 *   `pengajuan_dana.kebutuhan_id` menunjuk ke `kebutuhan.id`.
 *   Ada constraint UNIQUE sehingga satu kebutuhan hanya boleh punya satu
 *   pengajuan (tidak ada duplikasi data).
 */

export const STATUS_PERSETUJUAN_LABEL: Record<StatusPersetujuan, string> = {
  belum: "Belum Disetujui",
  disetujui: "Disetujui",
};

export const STATUS_PENGAMBILAN_LABEL: Record<StatusPengambilan, string> = {
  belum: "Belum Diambil",
  sudah_diambil: "Sudah Diambil",
};

export const STATUS_PERSETUJUAN_COLOR: Record<
  StatusPersetujuan,
  "amber" | "green"
> = {
  belum: "amber",
  disetujui: "green",
};

export const STATUS_PENGAMBILAN_COLOR: Record<
  StatusPengambilan,
  "slate" | "green"
> = {
  belum: "slate",
  sudah_diambil: "green",
};

/** Pengajuan yang belum pernah disetujui = perlu tindakan Bendahara. */
export function perluTindakanBendahara(p: {
  status_persetujuan: StatusPersetujuan;
  status_pengambilan: StatusPengambilan;
}): boolean {
  return p.status_persetujuan === "belum" || p.status_pengambilan === "belum";
}

/** Sudah final: disetujui + uang sudah diambil. */
export function sudahFinal(p: {
  status_persetujuan: StatusPersetujuan;
  status_pengambilan: StatusPengambilan;
}): boolean {
  return p.status_persetujuan === "disetujui" && p.status_pengambilan === "sudah_diambil";
}

/** Pengajuan dana yang sudah dilengkapi nama divisi, pengaju, dan kebutuhan. */
export interface PengajuanDanaDetail extends PengajuanDana {
  nama_divisi: string;
  nama_pengaju: string;
  nama_kebutuhan: string | null;
  /** true = sudah ada pengajuan dana lain untuk kebutuhan yang sama. */
  sudah_ada_pengajuan: boolean;
}

export async function fetchPengajuanDanaDetail(
  supabase: SupabaseClient<Database>,
  options: { divisiId?: string | null } = {}
): Promise<PengajuanDanaDetail[]> {
  let query = supabase
    .from("pengajuan_dana")
    .select(
      "id, divisi_id, user_id, kebutuhan_id, tanggal_pengajuan, nominal, keperluan, status_persetujuan, status_pengambilan, approved_by, approved_at, taken_by, taken_at, created_at, updated_at"
    )
    .order("tanggal_pengajuan", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.divisiId) query = query.eq("divisi_id", options.divisiId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as PengajuanDana[];
  if (rows.length === 0) return [];

  const { data: divisiList } = await supabase
    .from("divisi")
    .select("id, nama_divisi");
  const namaDivisi = new Map((divisiList ?? []).map((d) => [d.id, d.nama_divisi]));

  const userIds = [
    ...new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v))),
  ];
  const namaPengaju = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profil } = await supabase
      .from("profiles")
      .select("id, nama, email")
      .in("id", userIds);
    (profil ?? []).forEach((p) =>
      namaPengaju.set(p.id, p.nama || p.email || "Tanpa nama")
    );
  }

  const kebutuhanIds = [
    ...new Set(
      rows.map((r) => r.kebutuhan_id).filter((v): v is string => Boolean(v))
    ),
  ];
  const namaKebutuhan = new Map<string, string>();
  if (kebutuhanIds.length > 0) {
    const { data: kebutuhanList } = await supabase
      .from("kebutuhan")
      .select("id, nama_kebutuhan")
      .in("id", kebutuhanIds);
    (kebutuhanList ?? []).forEach((k) =>
      namaKebutuhan.set(k.id, k.nama_kebutuhan)
    );
  }

  return rows.map((row) => ({
    ...row,
    nama_divisi: namaDivisi.get(row.divisi_id) ?? "Divisi tidak ditemukan",
    nama_pengaju: namaPengaju.get(row.user_id) ?? "-",
    nama_kebutuhan: row.kebutuhan_id
      ? namaKebutuhan.get(row.kebutuhan_id) ?? null
      : null,
    sudah_ada_pengajuan: false,
  }));
}

/** Nama divisi milik admin divisi (dari database, bukan hardcode). */
export async function fetchNamaDivisi(
  supabase: SupabaseClient<Database>,
  divisiId: string
): Promise<string> {
  const { data } = await supabase
    .from("divisi")
    .select("nama_divisi")
    .eq("id", divisiId)
    .maybeSingle();
  return data?.nama_divisi ?? "Divisi";
}
