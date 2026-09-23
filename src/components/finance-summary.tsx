"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchFinanceSummary, type FinanceSummary as FinanceSummaryType } from "@/lib/finance";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { TrendingUp, TrendingDown, Wallet, Coins } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "emerald" | "rose" | "indigo" | "brand";
}

function MetricCard({
  label,
  value,
  sub,
  icon: IconComponent,
  variant,
}: MetricCardProps) {
  const styles = {
    emerald: {
      text: "text-emerald-600",
      bg: "bg-emerald-50/80",
      border: "border-emerald-100",
      ring: "ring-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    rose: {
      text: "text-rose-600",
      bg: "bg-rose-50/80",
      border: "border-rose-100",
      ring: "ring-rose-500/10",
      iconColor: "text-rose-600",
    },
    indigo: {
      text: "text-indigo-600",
      bg: "bg-indigo-50/80",
      border: "border-indigo-100",
      ring: "ring-indigo-500/10",
      iconColor: "text-indigo-600",
    },
    brand: {
      text: "text-brand-600",
      bg: "bg-brand-50/80",
      border: "border-brand-100",
      ring: "ring-brand-500/10",
      iconColor: "text-brand-600",
    },
  }[variant];

  return (
    <Card className="hover:shadow-elevated transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles.bg} ${styles.iconColor} ring-1 ${styles.ring}`}
          >
            <IconComponent className="h-4.5 w-4.5" />
          </div>
        </div>
        <p className={`mt-2 text-2xl font-bold tracking-tight ${styles.text}`}>
          {value}
        </p>
        {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function FinanceSummary({ title = "Ringkasan Keuangan OSIS" }: { title?: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceSummaryType>({
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
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
        <span className="text-xs font-medium text-slate-400">Akumulasi Real-Time</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Pemasukan"
          value={formatRupiah(data.pemasukan)}
          icon={TrendingUp}
          variant="emerald"
          sub="Akumulasi semua divisi"
        />
        <MetricCard
          label="Total Pengeluaran"
          value={formatRupiah(data.pengeluaran)}
          icon={TrendingDown}
          variant="rose"
          sub="Akumulasi semua divisi"
        />
        <MetricCard
          label="Saldo Awal"
          value={formatRupiah(data.saldoAwal)}
          icon={Wallet}
          variant="indigo"
          sub="Diset oleh Bendahara OSIS"
        />
        <MetricCard
          label="Total Saldo Kas"
          value={formatRupiah(data.totalSaldo)}
          icon={Coins}
          variant={data.totalSaldo >= 0 ? "brand" : "rose"}
          sub="Saldo Awal + Masuk - Keluar"
        />
      </div>
    </div>
  );
}