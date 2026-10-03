"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/role";
import type { Role } from "@/lib/types";
import {
  assignAdminAction,
  setDivisionPasswordAction,
  setUserRoleAction,
} from "../../actions/periode-actions";

interface AccountRow {
  id: string;
  nama: string;
  email: string;
  role: string;
  periodeId: string;
  periodeNama: string;
  assignedAt: string | null;
}

interface DivisionRow {
  divisiId: string;
  nomorDivisi: number;
  namaDivisi: string;
  accountCount: number;
  hasPassword: boolean;
  updatedAt: string | null;
}

interface PeriodOption {
  id: string;
  namaPeriode: string;
  status: "active" | "archived" | "inactive";
}

/** Role yang boleh dipilih. `super_admin` sengaja TIDAK ada di sini. */
const ASSIGNABLE_ROLES: Role[] = [
  "admin",
  "division_admin",
  "monitoring",
  "bendahara",
  "sekretaris",
];

function roleBadge(role: string) {
  if (role === "super_admin") return <Badge color="indigo">Super Admin</Badge>;
  if (role === "admin") return <Badge color="blue">Admin Periode</Badge>;
  if (role === "division_admin") return <Badge color="green">Admin Divisi</Badge>;
  return <Badge color="slate">{ROLE_LABELS[role as Role] ?? role}</Badge>;
}

export function AccountsAdminClient({
  currentUserId,
  selectedPeriodeId,
  periods,
  accounts,
  divisions,
}: {
  currentUserId: string;
  selectedPeriodeId: string;
  periods: PeriodOption[];
  accounts: AccountRow[];
  divisions: DivisionRow[];
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [periodeFilter, setPeriodeFilter] = useState(selectedPeriodeId);

  const visible = useMemo(() => {
    if (!periodeFilter) return accounts;
    return accounts.filter((a) => a.periodeId === periodeFilter);
  }, [accounts, periodeFilter]);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) success(result.message);
      else error(result.message);
    });
  }

  function handleAssign(userId: string, periodeId: string) {
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("periode_id", periodeId);
    run(() => assignAdminAction(fd));
  }

  function handleRole(userId: string, role: string) {
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("role", role);
    run(() => setUserRoleAction(fd));
  }

  function handlePassword(divisiId: string, password: string, periodeId: string) {
    const fd = new FormData();
    fd.set("divisi_id", divisiId);
    fd.set("password", password);
    fd.set("periode_id", periodeId);
    run(() => setDivisionPasswordAction(fd));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Filter Periode" />
        <CardContent>
          <Field label="Tampilkan akun periode">
            <Select
              value={periodeFilter}
              onChange={(e) => setPeriodeFilter(e.target.value)}
            >
              <option value="">Seluruh periode</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namaPeriode}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={`Akun (${visible.length})`} />
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada akun pada periode ini.
            </p>
          ) : (
            <TableWrap>
              <THead>
                <TR>
                  <TH>Pengguna</TH>
                  <TH>Role</TH>
                  <TH>Periode Ditugaskan</TH>
                  <TH className="text-right">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((a) => {
                  const isSelf = a.id === currentUserId;
                  return (
                    <TR key={a.id}>
                      <TD>
                        <p className="font-medium">{a.nama}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </TD>
                      <TD>{roleBadge(a.role)}</TD>
                      <TD>
                        {a.periodeId ? (
                          <span className="text-sm">{a.periodeNama}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Belum ditugaskan
                          </span>
                        )}
                      </TD>
                      <TD className="text-right">
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">
                            Akun Anda sendiri
                          </span>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            <Select
                              className="w-auto"
                              value={a.role}
                              disabled={pending}
                              onChange={(e) => handleRole(a.id, e.target.value)}
                            >
                              {!ASSIGNABLE_ROLES.includes(a.role as Role) && (
                                <option value={a.role}>{ROLE_LABELS[a.role as Role] ?? a.role}</option>
                              )}
                              {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </Select>
                            <Select
                              className="w-auto"
                              value={a.periodeId}
                              disabled={pending}
                              onChange={(e) => handleAssign(a.id, e.target.value)}
                            >
                              <option value="">Tanpa periode</option>
                              {periods.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.namaPeriode}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Password Divisi" />
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Ketua dan wakil divisi tidak dapat mengganti password sendiri.
            Password hanya dapat direset di sini.
          </p>
          <div className="space-y-3">
            {divisions.map((d) => (
              <PasswordRow
                key={d.divisiId}
                division={d}
                periods={periods}
                disabled={pending}
                onSubmit={handlePassword}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordRow({
  division,
  periods,
  disabled,
  onSubmit,
}: {
  division: DivisionRow;
  periods: PeriodOption[];
  disabled: boolean;
  onSubmit: (divisiId: string, password: string, periodeId: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [periodeId, setPeriodeId] = useState(periods.find((p) => p.status === "active")?.id ?? "");

  return (
    <div className="grid items-end gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto_1fr_auto] dark:border-slate-800">
      <div>
        <p className="font-medium">Divisi {division.nomorDivisi}</p>
        <p className="text-xs text-muted-foreground">
          {division.namaDivisi} · {division.accountCount} akun
        </p>
        <div className="mt-1">
          {division.hasPassword ? (
            <Badge color="green">Password tersedia</Badge>
          ) : (
            <Badge color="amber">Belum ada password</Badge>
          )}
        </div>
      </div>
      <Field label="Password Baru">
        <Input
          type="password"
          value={password}
          placeholder="Minimal 4 karakter"
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Periode">
        <Select value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.namaPeriode}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        disabled={disabled || password.length < 4}
        onClick={() => {
          onSubmit(division.divisiId, password, periodeId);
          setPassword("");
        }}
      >
        Reset
      </Button>
    </div>
  );
}
