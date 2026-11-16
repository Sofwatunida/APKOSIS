"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TransaksiKeuangan } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate } from "@/lib/date";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { FinanceSummary } from "@/components/finance-summary";
import { ExportMenu } from "@/components/export-menu";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { BuktiButton, BuktiPreviewModal } from "@/components/ui/bukti";
import { parseBukti, stripBukti } from "@/lib/bukti";

export function BendaharaHome({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<TransaksiKeuangan[]>([]);
  const [viewBukti, setViewBukti] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      setRecent(txs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Bendahara"
        description="Ringkasan keuangan dan transaksi terbaru OSIS."
      />
      <FinanceSummary />

      <Card>
        <CardHeader
          title="Transaksi Terbaru"
          action={
            <ExportMenu
              title="Transaksi Keuangan Terbaru"
              filename="transaksi-keuangan-terbaru"
              disabled={recent.length === 0}
              columns={[
                { header: "Tanggal", key: "tanggal", width: 14 },
                { header: "Jenis", key: "jenis", width: 14 },
                { header: "Keterangan", key: "keterangan", width: 40 },
                { header: "Nominal", key: "nominal", width: 20, align: "right" },
              ]}
              rows={recent.map((t) => ({
                tanggal: formatDate(t.tanggal),
                jenis: t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran",
                keterangan: stripBukti(t.keterangan) || "-",
                nominal: formatRupiah(t.nominal),
              }))}
            />
          }
        />
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <EmptyState title="Belum ada transaksi" />
          ) : (
            <TableWrap minWidth={820}>
              <THead>
                <tr>
                  <TH>Tanggal</TH>
                  <TH>Jenis</TH>
                  <TH>Keterangan</TH>
                  <TH>Bukti</TH>
                  <TH align="right">Nominal</TH>
                </tr>
              </THead>
              <TBody>
                {recent.map((t) => {
                  const { cleanKeterangan, buktiRef } = parseBukti(t.keterangan);
                  return (
                    <TR key={t.id}>
                      <TD className="whitespace-nowrap text-xs font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(t.tanggal)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <Badge color={t.jenis_transaksi === "pemasukan" ? "green" : "red"}>
                          {t.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
                        </Badge>
                      </TD>
                      <TD className="max-w-xs">
                        <span className="safe-text block truncate text-xs text-slate-600 dark:text-slate-400">
                          {cleanKeterangan || "-"}
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap">
                        <BuktiButton buktiRef={buktiRef} onOpen={setViewBukti} />
                      </TD>
                      <TD align="right" className="whitespace-nowrap font-bold text-slate-900 dark:text-white">
                        {formatRupiah(t.nominal)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <BuktiPreviewModal buktiRef={viewBukti} onClose={() => setViewBukti(null)} />
    </div>
  );
}