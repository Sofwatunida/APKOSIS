import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface FinanceSummary {
  saldoAwal: number;
  pemasukan: number;
  pengeluaran: number;
  totalSaldo: number;
}

export interface SaldoAwalEntry {
  divisiId: string | null;
  nominal: number;
}

/**
 * Nilai sentinel pilihan "Bendahara" pada form saldo awal.
 *
 * Baris saldo awal dengan `divisi_id = null` dipakai sebagai saldo
 * awal Bendahara (kas pusat / kas OSIS), terpisah dari saldo awal
 * masing-masing divisi.
 */
export const SALDO_BENDAHARA_TARGET = "bendahara";

/**
 * Semua baris saldo awal periode terpilih.
 *
 * Termasuk baris Bendahara (`divisi_id = null`) dan baris per divisi.
 * Periode sudah difilter otomatis oleh `src/lib/supabase/client.ts`,
 * jadi tidak mungkin mencampur saldo awal antarperiode.
 */
export async function fetchSaldoAwalEntries(
  supabase: SupabaseClient<Database>
): Promise<SaldoAwalEntry[]> {
  const { data } = await supabase
    .from("saldo_awal")
    .select("divisi_id, nominal");

  return (data ?? []).map((row) => ({
    divisiId: row.divisi_id,
    nominal: Number(row.nominal) || 0,
  }));
}

/** Peta `divisi_id` -> nominal saldo awal (baris Bendahara tidak ikut). */
export async function fetchSaldoAwalMap(
  supabase: SupabaseClient<Database>
): Promise<Map<string, number>> {
  const entries = await fetchSaldoAwalEntries(supabase);
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (entry.divisiId) map.set(entry.divisiId, entry.nominal);
  }
  return map;
}

/**
 * Saldo awal Bendahara (kas pusat) pada periode terpilih.
 *
 * Disimpan pada baris `saldo_awal` dengan `divisi_id = null` dan
 * diatur oleh role Bendahara dari halaman Transaksi.
 */
export async function fetchSaldoAwalBendahara(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data } = await supabase
    .from("saldo_awal")
    .select("nominal")
    .is("divisi_id", null)
    .maybeSingle();
  return Number(data?.nominal) || 0;
}

/**
 * Ringkasan kas untuk periode yang sedang dipilih.
 *
 * Saldo awal dijumlahkan dari saldo awal Bendahara (kas pusat) dan
 * seluruh divisi, sehingga kartu ringkasan selalu konsisten dengan
 * pengaturan saldo awal di halaman Transaksi.
 */
export async function fetchFinanceSummary(
  supabase: SupabaseClient<Database>,
  divisiId?: string | null
): Promise<FinanceSummary> {
  let query = supabase
    .from("transaksi_keuangan")
    .select("jenis_transaksi, nominal");
  if (divisiId) query = query.eq("divisi_id", divisiId);

  const [{ data: txs }, saldoAwal] = await Promise.all([
    query,
    fetchSaldoAwal(supabase, divisiId),
  ]);

  let pemasukan = 0;
  let pengeluaran = 0;
  (txs ?? []).forEach((t) => {
    const n = Number(t.nominal) || 0;
    if (t.jenis_transaksi === "pemasukan") pemasukan += n;
    else pengeluaran += n;
  });

  return {
    saldoAwal,
    pemasukan,
    pengeluaran,
    totalSaldo: saldoAwal + pemasukan - pengeluaran,
  };
}

/**
 * Total saldo awal periode terpilih.
 *
 * Tanpa `divisiId`, hasilnya saldo awal Bendahara (kas pusat) ditambah
 * saldo awal seluruh divisi. Dengan `divisiId`, hasilnya saldo awal
 * divisi tersebut saja (tanpa saldo awal Bendahara).
 */
export async function fetchSaldoAwal(
  supabase: SupabaseClient<Database>,
  divisiId?: string | null
): Promise<number> {
  if (divisiId) {
    const { data } = await supabase
      .from("saldo_awal")
      .select("nominal")
      .eq("divisi_id", divisiId)
      .maybeSingle();
    return Number(data?.nominal) || 0;
  }

  const entries = await fetchSaldoAwalEntries(supabase);
  return entries.reduce((total, entry) => total + entry.nominal, 0);
}

export interface SaveSaldoAwalInput {
  /** Nominal baru (>= 0, sudah divalidasi pemanggil). */
  nominal: number;
  /** User yang melakukan perubahan, untuk kolom `updated_by`. */
  userId: string | null;
  /** Periode tujuan. Selalu eksplisit supaya tidak bergantung cookie. */
  periodeId: string;
  /** `null` = saldo awal Bendahara (kas pusat). */
  divisiId?: string | null;
}

export interface SaldoAwalSaveError {
  message: string;
  code?: string;
}

/**
 * Menyimpan saldo awal satu tujuan pada satu periode.
 *
 * Identitas baris = (`periode_id`, `divisi_id`):
 *   - divisiId = null  -> saldo awal Bendahara (kas pusat)
 *   - divisiId = uuid  -> saldo awal divisi tersebut
 *
 * Jika baris sudah ada, data di-UPDATE (bukan insert duplikat). Bila dua
 * penyimpanan berjalan bersamaan dan salah satunya kalah balapan unique
 * index, percobaan kedua diarahkan ke UPDATE juga.
 */
export async function saveSaldoAwal(
  supabase: SupabaseClient<Database>,
  input: SaveSaldoAwalInput
): Promise<{ error: SaldoAwalSaveError | null }> {
  const { nominal, userId, periodeId, divisiId = null } = input;
  const updatedAt = new Date().toISOString();

  async function findExisting() {
    let query = supabase
      .from("saldo_awal")
      .select("id")
      .eq("periode_id", periodeId)
      .limit(1);
    query = divisiId
      ? query.eq("divisi_id", divisiId)
      : query.is("divisi_id", null);
    return query.maybeSingle();
  }

  async function updateExisting(id: string) {
    return supabase
      .from("saldo_awal")
      .update({ nominal, updated_by: userId, updated_at: updatedAt })
      .eq("id", id)
      .eq("periode_id", periodeId);
  }

  const { data: existing, error: findError } = await findExisting();
  if (findError) return { error: findError };

  if (existing?.id) {
    const { error } = await updateExisting(existing.id);
    return { error };
  }

  const { error } = await supabase.from("saldo_awal").insert({
    periode_id: periodeId,
    divisi_id: divisiId,
    nominal,
    updated_by: userId,
    updated_at: updatedAt,
  });

  if (!error) return { error: null };

  // 23505 = unique_violation: baris dibuat bersamaan oleh request lain.
  // Jangan gagal dengan duplikat; ulangi sebagai UPDATE.
  if (error.code === "23505") {
    const { data: raced } = await findExisting();
    if (raced?.id) {
      const { error: updateError } = await updateExisting(raced.id);
      return { error: updateError };
    }
  }

  return { error };
}
