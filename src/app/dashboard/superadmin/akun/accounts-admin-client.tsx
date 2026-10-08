"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Filter,
  KeyRound,
  Save,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { ExportMenu } from "@/components/export-menu";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/role";
import type { Role } from "@/lib/types";
import {
  assignAdminAction,
  setDivisionPasswordAction,
  setUserRoleAction,
} from "../../actions/periode-actions";

const MIN_PASSWORD_LENGTH = 4;

function divisiLabel(nomor: number): string {
  return `Divisi ${String(nomor).padStart(2, "0")}`;
}

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
  periodeId: string;
  periodeNama: string;
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

/** Ikon kecil di dalam badge role supaya role mudah dikenali sekilas. */
function roleBadge(role: string) {
  if (role === "super_admin")
    return (
      <Badge color="indigo">
        <ShieldCheck className="h-3 w-3" /> Super Admin
      </Badge>
    );
  if (role === "admin")
    return (
      <Badge color="blue">
        <CalendarRange className="h-3 w-3" /> Admin Periode
      </Badge>
    );
  if (role === "division_admin")
    return (
      <Badge color="green">
        <UserCog className="h-3 w-3" /> Admin Divisi
      </Badge>
    );
  return <Badge color="slate">{ROLE_LABELS[role as Role] ?? role}</Badge>;
}

export function AccountsAdminClient({
  currentUserId,
  selectedPeriodeId,
  dbErrors,
  periods,
  accounts,
  divisions,
}: {
  currentUserId: string;
  selectedPeriodeId: string;
  /** Error RPC dari server. Ditampilkan apa adanya, tidak pernah disembunyikan. */
  dbErrors?: string[];
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

  const sudahDiatur = useMemo(
    () => divisions.filter((d) => d.hasPassword).length,
    [divisions]
  );

  // Ekspor konfigurasi divisi. Password SENGAJA tidak ikut: yang diekspor
  // hanya status ("Sudah diatur"/"Belum diatur"), tidak pernah hash
  // maupun password aslinya.
  const exportRows = useMemo(
    () =>
      divisions.map((d) => ({
        no: d.nomorDivisi,
        divisi: divisiLabel(d.nomorDivisi),
        nama: d.namaDivisi,
        status: d.hasPassword ? "Sudah diatur" : "Belum diatur",
        periode: d.periodeNama !== "—" ? d.periodeNama : "-",
      })),
    [divisions]
  );

  return (
    <div className="space-y-6">
      {dbErrors && dbErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-900/20"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            Database menolak permintaan ({dbErrors.length}). Data di bawah mungkin
            tidak lengkap.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-rose-700 dark:text-rose-400">
            {dbErrors.map((m) => (
              <li key={m} className="break-words">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportMenu
          title="APKOSIS — Pengaturan Akun Divisi"
          subtitle="Daftar konfigurasi password & periode setiap divisi"
          filename="pengaturan-akun-divisi"
          columns={[
            { header: "No", key: "no", width: 0.6, align: "center" },
            { header: "Divisi", key: "divisi", width: 1.1 },
            { header: "Nama Divisi", key: "nama", width: 2 },
            { header: "Status Password", key: "status", width: 1.3, align: "center" },
            { header: "Periode", key: "periode", width: 1.2, align: "center" },
          ]}
          rows={exportRows}
        />
      </div>

      <Card>
        <CardHeader
          title="Filter Periode"
          subtitle="Sembunyikan akun dari periode lain tanpa mengubah data."
          icon={<Filter className="h-5 w-5" />}
        />
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
        <CardHeader
          title={`Akun (${visible.length})`}
          subtitle="Ubah role dan periode tugas tiap pengguna dari kolom Aksi."
          icon={<Users className="h-5 w-5" />}
        />
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
                      <TD className="whitespace-nowrap">{roleBadge(a.role)}</TD>
                      <TD className="whitespace-nowrap">
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
        <CardHeader
          title="Password Divisi"
          subtitle="Password di-hash (bcrypt) di server sebelum disimpan dan tidak pernah ditampilkan kembali."
          icon={<KeyRound className="h-5 w-5" />}
        />
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Ketua dan wakil divisi tidak dapat mengganti password sendiri.
            Password hanya dapat diatur di sini. Status di bawah dibaca langsung
            dari database, jadi tetap benar setelah halaman di-refresh.
          </p>

          {sudahDiatur > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs dark:border-slate-800/80 dark:bg-slate-900/60">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {sudahDiatur} / {divisions.length} divisi sudah punya password
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {divisions.length - sudahDiatur} belum punya password
              </span>
            </div>
          )}

          <div className="space-y-3">
            {divisions.map((d) => (
              <PasswordRow
                key={d.divisiId}
                division={d}
                periods={periods}
                disabled={pending}
              />
            ))}
            {divisions.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada data divisi.
              </p>
            )}
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
}: {
  division: DivisionRow;
  periods: PeriodOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  // Default dropdown mengikuti periode divisi di database; kalau divisi belum
  // punya periode, baru memakai periode aktif.
  const [periodeId, setPeriodeId] = useState(
    division.periodeId || periods.find((p) => p.status === "active")?.id || ""
  );
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState("");

  const sudahDiatur = division.hasPassword;
  const terakhirDiubah = formatWaktu(division.updatedAt);
  const valid = password.length >= MIN_PASSWORD_LENGTH && !saving && !disabled;

  async function handleSubmit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setRowError(`Password divisi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }

    setSaving(true);
    setRowError("");

    const fd = new FormData();
    fd.set("divisi_id", division.divisiId);
    fd.set("password", password);
    fd.set("periode_id", periodeId);

    const result = await setDivisionPasswordAction(fd);

    setSaving(false);

    if (!result.ok) {
      // Gagal: status TIDAK diubah, input dipertahankan supaya user
      // tidak perlu mengetik ulang, pesan error ditampilkan.
      setRowError(result.message);
      toastError(result.message);
      return;
    }

    setPassword("");
    success(
      `Password ${divisiLabel(division.nomorDivisi)} berhasil disimpan.`
    );
    // Status "sudah diatur" sekarang berasal dari database.
    router.refresh();
  }

  return (
    <div className="grid items-end gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_1.4fr_1fr_auto] dark:border-slate-800">
      <div>
        <p className="font-medium">{divisiLabel(division.nomorDivisi)}</p>
        <p className="text-xs text-muted-foreground">
          {division.namaDivisi} · {division.accountCount} akun
        </p>
        <div className="mt-1">
          {sudahDiatur ? (
            <Badge color="green">
              <ShieldCheck className="h-3 w-3" /> Password sudah diatur
            </Badge>
          ) : (
            <Badge color="amber">Belum ada password</Badge>
          )}
        </div>
        {terakhirDiubah && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Terakhir diubah {terakhirDiubah}
          </p>
        )}
      </div>

      <Field label="Password Baru">
        <Input
          type="password"
          value={password}
          maxLength={128}
          autoComplete="new-password"
          placeholder="Masukkan password baru"
          disabled={saving || disabled}
          onChange={(e) => {
            setPassword(e.target.value);
            if (rowError) setRowError("");
          }}
        />
      </Field>

      <Field label="Periode">
        <Select
          value={periodeId}
          onChange={(e) => setPeriodeId(e.target.value)}
          disabled={saving || disabled}
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.namaPeriode}
            </option>
          ))}
        </Select>
      </Field>

      <Button
        disabled={!valid}
        loading={saving}
        onClick={handleSubmit}
        className="min-w-28"
      >
        {sudahDiatur ? (
          <KeyRound className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        <span>{sudahDiatur ? "Ubah" : "Simpan"}</span>
      </Button>

      {rowError && (
        <p className="sm:col-span-4 text-xs font-medium text-rose-600 dark:text-rose-400">
          {rowError}
        </p>
      )}
    </div>
  );
}

function formatWaktu(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
