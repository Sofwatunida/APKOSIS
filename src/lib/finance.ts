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
 * Semua baris saldo awal periode terpilih.
 *
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

/** Peta `divisi_id` -> nominal saldo awal (baris umum lama tidak ikut). */
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
 * Ringkasan kas untuk periode yang sedang dipilih.
 *
 * Saldo awal dijumlahkan dari seluruh divisi (plus baris umum lama
 * bila masih ada), sehingga kartu ringkasan selalu konsisten dengan
 * tabel saldo awal per divisi.
 */
export async function fetchFinanceSummary(
  supabase: SupabaseClient<Database>
): Promise<FinanceSummary> {
  const { data: txs } = await supabase
    .from("transaksi_keuangan")
    .select("jenis_transaksi, nominal");

  let pemasukan = 0;
  let pengeluaran = 0;
  (txs ?? []).forEach((t) => {
    const n = Number(t.nominal) || 0;
    if (t.jenis_transaksi === "pemasukan") pemasukan += n;
    else pengeluaran += n;
  });

  const saldoAwal = await fetchSaldoAwal(supabase);
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
 * Tanpa `divisiId`, hasilnya jumlah saldo awal seluruh divisi. Baris
 * umum lama (tanpa divisi) hanya dipakai sebagai fallback bila belum
 * ada satu pun saldo awal per divisi, sehingga tidak terjadi hitung
 * ganda. Dengan `divisiId`, hasilnya saldo awal divisi tersebut saja.
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
  const perDivisi = entries.filter((entry) => entry.divisiId);
  const used = perDivisi.length > 0 ? perDivisi : entries;
  return used.reduce((total, entry) => total + entry.nominal, 0);
}

/**
 * Menyimpan saldo awal satu divisi pada periode terpilih.
 *
 * `periode_id` diisi otomatis oleh period scope. Unik per
 * (periode_id, divisi_id) sehingga saldo awal antarperiode maupun
 * antardivisi tidak saling menimpa. `divisiId = null` menulis baris
 * umum lama (fallback) dan hanya dipakai untuk kompatibilitas.
 */
export async function saveSaldoAwal(
  supabase: SupabaseClient<Database>,
  nominal: number,
  userId: string | null,
  divisiId: string | null = null
): Promise<{ error: { message: string } | null }> {
  const existingQuery = supabase.from("saldo_awal").select("id");
  const { data: existing, error: findError } = divisiId
    ? await existingQuery.eq("divisi_id", divisiId).maybeSingle()
    : await existingQuery.is("divisi_id", null).maybeSingle();

  if (findError) return { error: findError };

  if (existing?.id) {
    const { error } = await supabase
      .from("saldo_awal")
      .update({ nominal, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { error };
  }

  const { error } = await supabase.from("saldo_awal").insert({
    nominal,
    updated_by: userId,
    updated_at: new Date().toISOString(),
    divisi_id: divisiId,
  });
  return { error };
}
