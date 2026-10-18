"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/export-menu";
import { Field, Input, Select } from "@/components/ui/form";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/role";
import type { Role } from "@/lib/types";
import type { AuditRow } from "./page";

const ACTIONS = [
  "buat_periode",
  "aktifkan_periode",
  "arsipkan_periode",
  "tugaskan_periode_user",
  "ubah_role_user",
  "atur_password_divisi",
  "atur_periode_divisi",
  "buat_divisi",
];

function actionLabel(a: string): string {
  const map: Record<string, string> = {
    buat_periode: "Buat Periode",
    aktifkan_periode: "Aktifkan Periode",
    arsipkan_periode: "Arsipkan Periode",
    tugaskan_periode_user: "Tugaskan Periode User",
    ubah_role_user: "Ubah Role User",
    atur_password_divisi: "Atur Password Divisi",
    atur_periode_divisi: "Atur Periode Divisi",
    buat_divisi: "Tambah Divisi",
  };
  return map[a] ?? a;
}

function formatWaktu(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(d);
}

export function AuditClient({
  rows,
  limit,
}: {
  rows: AuditRow[];
  limit: number;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (roleFilter && (r.actorRole ?? "") !== roleFilter) return false;
      if (statusFilter === "ok" && !r.success) return false;
      if (statusFilter === "fail" && r.success) return false;
      if (dateFrom && r.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false;
      if (debounced) {
        const hay = [
          r.actorEmail ?? "",
          r.action,
          actionLabel(r.action),
          r.targetType ?? "",
          r.targetId ?? "",
          r.detail ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(debounced)) return false;
      }
      return true;
    });
  }, [rows, roleFilter, statusFilter, dateFrom, dateTo, debounced]);

  const exportRows = useMemo(
    () =>
      filtered.map((r) => ({
        waktu: formatWaktu(r.createdAt),
        aktor: r.actorEmail ?? "-",
        role: (ROLE_LABELS[r.actorRole as Role] as string) ?? r.actorRole ?? "-",
        aksi: actionLabel(r.action),
        target: [r.targetType, r.targetId].filter(Boolean).join(" · ") || "-",
        detail: r.detail ?? "-",
        status: r.success ? "Berhasil" : "Gagal",
      })),
    [filtered]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Cari">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email, aksi, target..."
              className="pl-9"
            />
          </div>
        </Field>
        <Field label="Role aktor">
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Semua role</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua status</option>
            <option value="ok">Berhasil</option>
            <option value="fail">Gagal</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dari tanggal">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Sampai">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Menampilkan {filtered.length} dari {rows.length} log
          {rows.length >= limit ? ` (maksimal ${limit} terbaru)` : ""}
        </span>
        <ExportMenu
          title="APKOSIS — Log Aktivitas"
          subtitle="Riwayat tindakan penting di sistem"
          filename="log-aktivitas"
          columns={[
            { header: "Waktu", key: "waktu", width: 1.6 },
            { header: "Aktor", key: "aktor", width: 1.6 },
            { header: "Role", key: "role", width: 1 },
            { header: "Aksi", key: "aksi", width: 1.4 },
            { header: "Target", key: "target", width: 1.4 },
            { header: "Detail", key: "detail", width: 1.6 },
            { header: "Status", key: "status", width: 0.9, align: "center" },
          ]}
          rows={exportRows}
        />
      </div>

      <TableWrap minWidth={900}>
        <THead>
          <TR>
            <TH>Waktu</TH>
            <TH>Aktor</TH>
            <TH>Aksi</TH>
            <TH>Target</TH>
            <TH>Detail</TH>
            <TH className="text-center">Status</TH>
          </TR>
        </THead>
        <TBody>
          {filtered.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-xs">{formatWaktu(r.createdAt)}</TD>
              <TD>
                <p className="text-sm">{r.actorEmail ?? "-"}</p>
                <p className="text-xs text-muted-foreground">
                  {(ROLE_LABELS[r.actorRole as Role] as string) ?? r.actorRole ?? "-"}
                </p>
              </TD>
              <TD className="whitespace-nowrap text-sm">{actionLabel(r.action)}</TD>
              <TD className="text-xs">
                {r.targetType ? (
                  <span>
                    {r.targetType}
                    {r.targetId ? ` · ${r.targetId.slice(0, 8)}` : ""}
                  </span>
                ) : (
                  "-"
                )}
              </TD>
              <TD className="max-w-[240px] truncate text-xs" title={r.detail ?? ""}>
                {r.detail ?? "-"}
              </TD>
              <TD className="text-center">
                {r.success ? (
                  <Badge color="green">Berhasil</Badge>
                ) : (
                  <Badge color="red">Gagal</Badge>
                )}
              </TD>
            </TR>
          ))}
          {filtered.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada log yang cocok dengan filter.
              </TD>
            </TR>
          )}
        </TBody>
      </TableWrap>
    </div>
  );
}
