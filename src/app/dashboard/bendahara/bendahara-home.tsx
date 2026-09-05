"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate } from "@/lib/date";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner, EmptyState } from "@/components/ui/feedback";

export function BendaharaHome({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState({ pemasukan: 0, pengeluaran: 0 });
  const [recent, setRecent] = useState<TransaksiKeuangan[]>([]);

  useEffect(() => {
    async function load() {
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      let pemasukan = 0;
      let pengeluaran = 0;
      (txs ?? []).forEach((t) => {
        const n = Number(t.nominal) || 0;
        if (t.jenis_transaksi === "pemasukan") pemasukan += n;
        else pengeluaran += n;
      });
      setFinance({ pemasukan, pengeluaran });
      setRecent(txs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const saldo = finance.pemasukan - finance.pengeluaran;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Bendahara</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Pemasukan</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatRupiah(finance.pemasukan)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Pengeluaran</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatRupiah(finance.pengeluaran)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Saldo</p>
            <p className={`mt-1 text-2xl font-bold ${saldo >= 0 ? "text-brand-600" : "text-red-600"}`}>
              {formatRupiah(saldo)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transaksi Terbaru" />
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState title="Belum ada transaksi" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Keterangan</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.tanggal)}</td>
                      <td className="px-3 py-2">
                        <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                          {t.jenis_transaksi}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{t.keterangan}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatRupiah(t.nominal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
