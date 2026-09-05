"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ExportKeuanganClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/export/keuangan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        error(err.error || "Gagal membuat export.");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apkosis-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      success("Export Excel keuangan berhasil diunduh.");
    } catch {
      error("Terjadi kesalahan saat export.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Export Keuangan</h1>
      <Card>
        <CardHeader
          title="Export Excel Keuangan Seluruh Divisi"
          subtitle="Satu file Excel berisi: Rekap per Divisi, Transaksi, dan Rekap Bulanan"
        />
        <CardContent>
          <p className="mb-4 text-sm text-slate-600">
            Export seluruh data keuangan ke satu file Excel yang rapi.
          </p>
          <Button onClick={handleExport} loading={loading}>
            {loading ? "Membuat file..." : "Export Excel"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
