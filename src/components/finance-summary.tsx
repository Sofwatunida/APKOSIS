"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchFinanceSummary, type FinanceSummary } from "@/lib/finance";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";

function SummaryCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function FinanceSummary({ title = "Ringkasan Keuangan OSIS" }: { title?: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceSummary>({
    saldoAwal: 0,
    pemasukan: 0,
    pengeluaran: 0,
    totalSaldo: 0,
  });

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetchFinanceSummary(supabase);
      if (active) {
        setData(res);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Pemasukan (Semua Divisi)"
          value={formatRupiah(data.pemasukan)}
          color="text-emerald-600"
        />
        <SummaryCard
          label="Total Pengeluaran (Semua Divisi)"
          value={formatRupiah(data.pengeluaran)}
          color="text-red-600"
        />
        <SummaryCard
          label="Saldo Awal"
          value={formatRupiah(data.saldoAwal)}
          color="text-indigo-600"
          sub="Diset oleh Bendahara"
        />
        <SummaryCard
          label="Total Saldo OSIS"
          value={formatRupiah(data.totalSaldo)}
          color={data.totalSaldo >= 0 ? "text-brand-600" : "text-red-600"}
          sub="Saldo Awal + Pemasukan - Pengeluaran"
        />
      </div>
    </div>
  );
}