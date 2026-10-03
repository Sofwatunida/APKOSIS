import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface FinanceSummary {
  saldoAwal: number;
  pemasukan: number;
  pengeluaran: number;
  totalSaldo: number;
}

/**
 * Ringkasan kas untuk periode yang sedang dipilih.
 *
 * Periode sudah difilter oleh `src/lib/supabase/client.ts`
 * (query otomatis diberi `periode_id`), sehingga fungsi ini TIDAK
 * pernah menggabungkan data antarperiode.
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

  const { data: saldo } = await supabase
    .from("saldo_awal")
    .select("nominal")
    .maybeSingle();

  const saldoAwal = Number(saldo?.nominal) || 0;
  return {
    saldoAwal,
    pemasukan,
    pengeluaran,
    totalSaldo: saldoAwal + pemasukan - pengeluaran,
  };
}

/** Saldo awal KHUSUS periode terpilih (satu baris per periode). */
export async function fetchSaldoAwal(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data: saldo } = await supabase
    .from("saldo_awal")
    .select("nominal")
    .maybeSingle();
  return Number(saldo?.nominal) || 0;
}

/**
 * Menyimpan saldo awal periode terpilih.
 * `periode_id` diisi otomatis oleh period scope, dan unik per periode
 * sehingga saldo awal antarperiode tidak saling menimpa.
 */
export async function saveSaldoAwal(
  supabase: SupabaseClient<Database>,
  nominal: number,
  userId: string | null
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from("saldo_awal")
    .upsert(
      { nominal, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: "periode_id" }
    );
  return { error };
}