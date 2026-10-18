"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { activatePeriodeAction, archivePeriodeAction } from "../../actions/periode-actions";

export interface PeriodeRow {
  id: string;
  nama_periode: string;
  tahun_mulai: number;
  tahun_selesai: number;
  status: "active" | "archived" | "inactive";
  jumlah_laporan: number;
  jumlah_transaksi: number;
  jumlah_anggota: number;
}

function statusBadge(status: PeriodeRow["status"]) {
  if (status === "active") return <Badge color="green">Aktif</Badge>;
  if (status === "archived") return <Badge color="slate">Arsip</Badge>;
  return <Badge color="amber">Belum Aktif</Badge>;
}

export function PeriodeAdminClient({ periods }: { periods: PeriodeRow[] }) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const visible = useMemo(() => {
    if (!debounced) return periods;
    return periods.filter((p) => p.nama_periode.toLowerCase().includes(debounced));
  }, [periods, debounced]);

  function activate(id: string, nama: string) {
    if (
      !window.confirm(
        `Aktifkan periode ${nama}?\n\nPeriode sebelumnya otomatis diarsipkan. Data lama tetap tersimpan dan hanya bisa dibaca.`
      )
    ) {
      return;
    }
    setBusy(id);
    startTransition(async () => {
      const result = await activatePeriodeAction(null, makeFormData(id));
      setBusy(null);
      if (result.ok) success(result.message);
      else error(result.message);
    });
  }

  function archive(id: string, nama: string) {
    if (
      !window.confirm(
        `Arsipkan periode ${nama}?\n\nSetelah diarsipkan, data periode ini tidak bisa ditambah atau diubah.`
      )
    ) {
      return;
    }
    setBusy(id);
    startTransition(async () => {
      const result = await archivePeriodeAction(makeFormData(id));
      setBusy(null);
      if (result.ok) success(result.message);
      else error(result.message);
    });
  }

  if (periods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada periode. Buat periode baru terlebih dahulu.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama periode..."
          className="pl-9"
        />
      </div>
      <TableWrap>
        <THead>
          <TR>
            <TH>Periode</TH>
            <TH>Status</TH>
            <TH className="text-right">Laporan</TH>
            <TH className="text-right">Transaksi</TH>
            <TH className="text-right">Anggota</TH>
            <TH className="text-right">Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {visible.map((p) => (
            <TR key={p.id}>
              <TD>
                <p className="font-medium">{p.nama_periode}</p>
                <p className="text-xs text-muted-foreground">
                  {p.tahun_mulai}/{p.tahun_selesai}
                </p>
              </TD>
              <TD className="whitespace-nowrap">{statusBadge(p.status)}</TD>
              <TD className="text-right tabular-nums">{p.jumlah_laporan}</TD>
              <TD className="text-right tabular-nums">{p.jumlah_transaksi}</TD>
              <TD className="text-right tabular-nums">{p.jumlah_anggota}</TD>
              <TD className="text-right">
                <div className="flex justify-end gap-2">
                  {p.status !== "active" && (
                    <Button
                      size="sm"
                      disabled={pending || busy === p.id}
                      onClick={() => activate(p.id, p.nama_periode)}
                    >
                      Aktifkan
                    </Button>
                  )}
                  {p.status === "active" ? (
                    <span className="text-xs text-muted-foreground">
                      Sedang berjalan
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || busy === p.id}
                      onClick={() => archive(p.id, p.nama_periode)}
                    >
                      Arsipkan
                    </Button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
          {visible.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada periode yang cocok dengan pencarian.
              </TD>
            </TR>
          )}
        </TBody>
      </TableWrap>
    </div>
  );
}

function makeFormData(periodeId: string): FormData {
  const fd = new FormData();
  fd.set("periode_id", periodeId);
  return fd;
}
