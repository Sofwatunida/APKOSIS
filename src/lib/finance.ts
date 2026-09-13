import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface FinanceSummary {
  saldoAwal: number;
  pemasukan: number;
  pengeluaran: number;
  totalSaldo: number;
}

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
    .eq("id", 1)
    .maybeSingle();

  const saldoAwal = Number(saldo?.nominal) || 0;
  return {
    saldoAwal,
    pemasukan,
    pengeluaran,
    totalSaldo: saldoAwal + pemasukan - pengeluaran,
  };
}

export async function fetchSaldoAwal(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data: saldo } = await supabase
    .from("saldo_awal")
    .select("nominal")
    .eq("id", 1)
    .maybeSingle();
  return Number(saldo?.nominal) || 0;
}