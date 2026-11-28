"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ExportMenu } from "@/components/export-menu";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import {
  TablePagination,
  usePagination,
} from "@/components/ui/pagination";
import { formatDivisiLabel } from "@/lib/divisi-options";
import { ROLE_LABELS } from "@/lib/role";
import type { Role } from "@/lib/types";
import {
  assignAdminAction,
  createDivisiAction,
  deleteAccountAction,
  deleteDivisiAction,
  setAccountPasswordAction,
  setDivisionPasswordAction,
  setDivisiPeriodAction,
  setUserRoleAction,
  updateAccountNameAction,
  updateDivisiAction,
} from "../../actions/periode-actions";
import { startImpersonationAction } from "../../actions/impersonation-actions";

const MIN_PASSWORD_LENGTH = 4;
const MIN_ACCOUNT_PASSWORD_LENGTH = 8;

interface AccountRow {
  id: string;
  nama: string;
  email: string;
  role: string;
  periodeId: string;
  periodeNama: string;
  divisiId: string;
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
  /** Error query dari server. Ditampilkan apa adanya, tidak pernah disembunyikan. */
  dbErrors?: string[];
  periods: PeriodOption[];
  accounts: AccountRow[];
  divisions: DivisionRow[];
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accountPeriodeFilter, setAccountPeriodeFilter] = useState(selectedPeriodeId);
  const [divisionPeriodeFilter, setDivisionPeriodeFilter] = useState(selectedPeriodeId);
  const [accountSearch, setAccountSearch] = useState("");
  const [divisionSearch, setDivisionSearch] = useState("");
  const [debouncedAccountSearch, setDebouncedAccountSearch] = useState("");
  const [debouncedDivisionSearch, setDebouncedDivisionSearch] = useState("");
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [editingDivision, setEditingDivision] = useState<DivisionRow | null>(null);
  const [passwordAccount, setPasswordAccount] = useState<AccountRow | null>(null);
  const [passwordDivision, setPasswordDivision] = useState<DivisionRow | null>(null);
  const [addingDivision, setAddingDivision] = useState(false);
  const [impersonatingAccount, setImpersonatingAccount] =
    useState<AccountRow | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedAccountSearch(accountSearch.trim().toLowerCase()),
      250
    );
    return () => clearTimeout(id);
  }, [accountSearch]);

  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedDivisionSearch(divisionSearch.trim().toLowerCase()),
      250
    );
    return () => clearTimeout(id);
  }, [divisionSearch]);

  const divisionById = useMemo(
    () => new Map<string, DivisionRow>(divisions.map((d) => [d.divisiId, d])),
    [divisions]
  );

  const visibleAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const division = account.divisiId
        ? divisionById.get(account.divisiId) ?? null
        : null;
      const periodeId = division?.periodeId || account.periodeId;

      if (accountPeriodeFilter && periodeId !== accountPeriodeFilter) return false;
      if (!debouncedAccountSearch) return true;

      return [
        account.nama,
        account.email,
        ROLE_LABELS[account.role as Role] ?? account.role,
        account.periodeNama,
      ].some((part) => part.toLowerCase().includes(debouncedAccountSearch));
    });
  }, [accounts, accountPeriodeFilter, debouncedAccountSearch, divisionById]);

  const visibleDivisions = useMemo(() => {
    return divisions.filter((division) => {
      if (divisionPeriodeFilter && division.periodeId !== divisionPeriodeFilter) {
        return false;
      }
      if (!debouncedDivisionSearch) return true;

      return [
        division.namaDivisi,
        String(division.nomorDivisi),
        division.periodeNama,
      ].some((part) => part.toLowerCase().includes(debouncedDivisionSearch));
    });
  }, [divisions, divisionPeriodeFilter, debouncedDivisionSearch]);

  const accountPagination = usePagination(visibleAccounts.length);
  const divisionPagination = usePagination(visibleDivisions.length);
  const resetAccountPage = accountPagination.reset;
  const resetDivisionPage = divisionPagination.reset;

  useEffect(() => {
    resetAccountPage();
  }, [debouncedAccountSearch, accountPeriodeFilter, resetAccountPage]);

  useEffect(() => {
    resetDivisionPage();
  }, [debouncedDivisionSearch, divisionPeriodeFilter, resetDivisionPage]);

  const pagedAccounts = accountPagination.showAll
    ? visibleAccounts
    : visibleAccounts.slice(
        (accountPagination.page - 1) * accountPagination.pageSize,
        accountPagination.page * accountPagination.pageSize
      );

  const pagedDivisions = divisionPagination.showAll
    ? visibleDivisions
    : visibleDivisions.slice(
        (divisionPagination.page - 1) * divisionPagination.pageSize,
        divisionPagination.page * divisionPagination.pageSize
      );

  function run(
    action: () => Promise<{ ok: boolean; message: string }>,
    refreshAfter = false
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        success(result.message);
        if (refreshAfter) router.refresh();
      } else {
        error(result.message);
      }
    });
  }

  function canImpersonate(account: AccountRow): boolean {
    if (account.id === currentUserId) return false;
    return ASSIGNABLE_ROLES.includes(account.role as Role);
  }

  function handleRole(userId: string, role: string) {
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("role", role);
    run(() => setUserRoleAction(fd), true);
  }

  function handleAccountPeriode(userId: string, periodeId: string) {
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("periode_id", periodeId);
    run(() => assignAdminAction(fd), true);
  }

  function handleDivisionPeriode(divisiId: string, periodeId: string) {
    const fd = new FormData();
    fd.set("divisi_id", divisiId);
    fd.set("periode_id", periodeId);
    run(() => setDivisiPeriodAction(fd), true);
  }

  function handleDeleteAccount(account: AccountRow) {
    const label = account.email !== "—" ? account.email : account.nama;
    if (
      !window.confirm(
        `Hapus akun "${account.nama}" (${label})?\n\nAkun akan kehilangan akses ke APKOSIS dan tidak bisa dikembalikan.`
      )
    ) {
      return;
    }

    const fd = new FormData();
    fd.set("user_id", account.id);
    run(() => deleteAccountAction(fd), true);
  }

  function handleDeleteDivision(division: DivisionRow) {
    if (
      !window.confirm(
        `Hapus ${formatDivisiLabel(division.nomorDivisi, division.namaDivisi)}?\n\nData terkait divisi ini dapat ikut terhapus dan tidak bisa dikembalikan.`
      )
    ) {
      return;
    }

    const fd = new FormData();
    fd.set("divisi_id", division.divisiId);
    run(() => deleteDivisiAction(fd), true);
  }

  // Ekspor konfigurasi divisi. Password SENGAJA tidak ikut: yang diekspor
  // hanya status ("Sudah diatur"/"Belum diatur"), tidak pernah hash
  // maupun password aslinya.
  const exportRows = useMemo(
    () =>
      divisions.map((d) => ({
        divisi: formatDivisiLabel(d.nomorDivisi, d.namaDivisi),
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

      <Card>
        <CardHeader
          title="Pengaturan Password Akun & Role"
          icon={<Users className="h-5 w-5" />}
        />
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Cari nama, email, atau role..."
                className="pl-9"
                aria-label="Cari akun role"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Saring akun berdasarkan periode"
                value={accountPeriodeFilter}
                onChange={(e) => setAccountPeriodeFilter(e.target.value)}
                className="w-auto"
              >
                <option value="">Seluruh periode</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPeriode}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {visibleAccounts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {debouncedAccountSearch || accountPeriodeFilter
                ? "Tidak ada akun yang cocok dengan filter."
                : "Belum ada akun role."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200/80 dark:ring-slate-800/80">
              <TableWrap minWidth={720} className="rounded-xl">
                <THead>
                  <TR>
                    <TH>Akun</TH>
                    <TH>Role</TH>
                    <TH>Periode</TH>
                    <TH className="text-right">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {pagedAccounts.map((a) => {
                    const d = a.divisiId
                      ? divisionById.get(a.divisiId) ?? null
                      : null;
                    const isSelf = a.id === currentUserId;
                    return (
                      <TR key={`akun-${a.id}`}>
                        <TD>
                          <p className="font-medium">{a.nama}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </TD>
                        <TD className="whitespace-nowrap">
                          {isSelf ? (
                            <span className="text-sm">
                              {ROLE_LABELS[a.role as Role] ?? a.role}
                            </span>
                          ) : (
                            <Select
                              className="w-auto min-w-36"
                              value={a.role}
                              disabled={pending}
                              aria-label={`Role ${a.nama}`}
                              onChange={(e) => handleRole(a.id, e.target.value)}
                            >
                              {!ASSIGNABLE_ROLES.includes(a.role as Role) && (
                                <option value={a.role}>
                                  {ROLE_LABELS[a.role as Role] ?? a.role}
                                </option>
                              )}
                              {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </Select>
                          )}
                        </TD>
                        <TD className="whitespace-nowrap">
                          {isSelf ? (
                            <span className="text-sm">
                              {d?.periodeNama || a.periodeNama}
                            </span>
                          ) : d ? (
                            <Select
                              className="w-auto min-w-36"
                              value={d.periodeId}
                              disabled={pending}
                              aria-label={`Periode ${a.nama}`}
                              onChange={(e) =>
                                handleDivisionPeriode(d.divisiId, e.target.value)
                              }
                            >
                              <option value="">Tanpa periode</option>
                              {periods.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.namaPeriode}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Select
                              className="w-auto min-w-36"
                              value={a.periodeId}
                              disabled={pending}
                              aria-label={`Periode ${a.nama}`}
                              onChange={(e) =>
                                handleAccountPeriode(a.id, e.target.value)
                              }
                            >
                              <option value="">Tanpa periode</option>
                              {periods.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.namaPeriode}
                                </option>
                              ))}
                            </Select>
                          )}
                        </TD>
                        <TD className="whitespace-nowrap text-right">
                          {isSelf ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex justify-end gap-1">
                              {canImpersonate(a) && (
                                <IconButton
                                  label={`Masuk mode penyamaran sebagai ${a.nama}`}
                                  title="Mode Penyamaran"
                                  disabled={pending}
                                  onClick={() => setImpersonatingAccount(a)}
                                >
                                  <Eye className="h-4 w-4" />
                                </IconButton>
                              )}
                              <IconButton
                                label={`Ubah ${a.nama}`}
                                title="Ubah akun"
                                disabled={pending}
                                onClick={() => setEditingAccount(a)}
                              >
                                <Pencil className="h-4 w-4" />
                              </IconButton>
                              <IconButton
                                label={`Atur password ${a.nama}`}
                                title="Atur password akun"
                                disabled={pending}
                                onClick={() => setPasswordAccount(a)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </IconButton>
                              <IconButton
                                label={`Hapus ${a.nama}`}
                                title="Hapus akun"
                                tone="danger"
                                disabled={pending}
                                onClick={() => handleDeleteAccount(a)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </div>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableWrap>
            </div>
          )}
          <TablePagination
            total={visibleAccounts.length}
            page={accountPagination.page}
            pageCount={accountPagination.pageCount}
            showAll={accountPagination.showAll}
            start={accountPagination.start}
            end={accountPagination.end}
            label="akun"
            onPageChange={accountPagination.goTo}
            onToggleAll={accountPagination.toggleShowAll}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Pengaturan Password Akun Divisi"
          icon={<Building2 className="h-5 w-5" />}
          action={
            <>
              <ExportMenu
                title="APKOSIS — Akun Divisi"
                filename="pengaturan-password-divisi"
                columns={[
                  { header: "Divisi", key: "divisi", width: 1.8 },
                  { header: "Status Password", key: "status", width: 1.3, align: "center" },
                  { header: "Periode", key: "periode", width: 1.2, align: "center" },
                ]}
                rows={exportRows}
              />
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setAddingDivision(true)}
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Divisi</span>
              </Button>
            </>
          }
        />
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={divisionSearch}
                onChange={(e) => setDivisionSearch(e.target.value)}
                placeholder="Cari divisi atau periode..."
                className="pl-9"
                aria-label="Cari akun divisi"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Saring divisi berdasarkan periode"
                value={divisionPeriodeFilter}
                onChange={(e) => setDivisionPeriodeFilter(e.target.value)}
                className="w-auto"
              >
                <option value="">Seluruh periode</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPeriode}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {visibleDivisions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {debouncedDivisionSearch || divisionPeriodeFilter
                ? "Tidak ada divisi yang cocok dengan filter."
                : "Belum ada akun divisi."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200/80 dark:ring-slate-800/80">
              <TableWrap minWidth={760} className="rounded-xl">
                <THead>
                  <TR>
                    <TH>Divisi</TH>
                    <TH>Status Password</TH>
                    <TH>Periode</TH>
                    <TH className="text-right">Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {pagedDivisions.map((d) => (
                    <TR key={`divisi-${d.divisiId}`}>
                      <TD className="font-medium">
                        {formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}
                      </TD>
                      <TD>
                        {d.hasPassword ? (
                          <Badge color="green">Sudah diatur</Badge>
                        ) : (
                          <Badge color="amber">Belum diatur</Badge>
                        )}
                        {formatWaktu(d.updatedAt) && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatWaktu(d.updatedAt)}
                          </p>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <Select
                          className="w-auto min-w-36"
                          value={d.periodeId}
                          disabled={pending}
                          aria-label={`Periode ${formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}`}
                          onChange={(e) =>
                            handleDivisionPeriode(d.divisiId, e.target.value)
                          }
                        >
                          <option value="">Tanpa periode</option>
                          {periods.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.namaPeriode}
                            </option>
                          ))}
                        </Select>
                      </TD>
                      <TD className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            label={`Ubah ${formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}`}
                            title="Ubah divisi"
                            disabled={pending}
                            onClick={() => setEditingDivision(d)}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label={`Atur password ${formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}`}
                            title="Atur password divisi"
                            disabled={pending}
                            onClick={() => setPasswordDivision(d)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label={`Hapus ${formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}`}
                            title="Hapus divisi"
                            tone="danger"
                            disabled={pending}
                            onClick={() => handleDeleteDivision(d)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>
          )}
          <TablePagination
            total={visibleDivisions.length}
            page={divisionPagination.page}
            pageCount={divisionPagination.pageCount}
            showAll={divisionPagination.showAll}
            start={divisionPagination.start}
            end={divisionPagination.end}
            label="divisi"
            onPageChange={divisionPagination.goTo}
            onToggleAll={divisionPagination.toggleShowAll}
          />
        </CardContent>
      </Card>

      {editingAccount && (
        <EditAccountModal
          key={editingAccount.id}
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {editingDivision && (
        <EditDivisiModal
          key={editingDivision.divisiId}
          division={editingDivision}
          periods={periods}
          onClose={() => setEditingDivision(null)}
        />
      )}

      {passwordAccount && (
        <AccountPasswordModal
          key={passwordAccount.id}
          account={passwordAccount}
          onClose={() => setPasswordAccount(null)}
        />
      )}

      {passwordDivision && (
        <PasswordModal
          key={passwordDivision.divisiId}
          division={passwordDivision}
          periods={periods}
          onClose={() => setPasswordDivision(null)}
        />
      )}

      {addingDivision && (
        <TambahDivisiModal
          periods={periods}
          existingNomor={divisions.map((d) => d.nomorDivisi)}
          onClose={() => setAddingDivision(false)}
        />
      )}

      {impersonatingAccount &&
        (impersonatingAccount.role === "division_admin" ? (
          <ImpersonationDivisionModal
            key={impersonatingAccount.id}
            account={impersonatingAccount}
            divisions={divisions}
            onClose={() => setImpersonatingAccount(null)}
          />
        ) : (
          <ImpersonationConfirmModal
            key={impersonatingAccount.id}
            account={impersonatingAccount}
            onClose={() => setImpersonatingAccount(null)}
          />
        ))}
    </div>
  );
}

function ImpersonationDivisionModal({
  account,
  divisions,
  onClose,
}: {
  account: AccountRow;
  divisions: DivisionRow[];
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [divisiId, setDivisiId] = useState(() =>
    account.divisiId && divisions.some((d) => d.divisiId === account.divisiId)
      ? account.divisiId
      : ""
  );
  const roleLabel = ROLE_LABELS[account.role as Role] ?? account.role;

  function handleMasuk() {
    if (!divisiId) {
      error("Pilih divisi terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const result = await startImpersonationAction({
        accountId: account.id,
        divisiId,
      });
      if (!result.ok) {
        error(result.message);
        return;
      }
      success(result.message);
      onClose();
      router.push("/dashboard");
    });
  }

  return (
    <Modal open onClose={onClose} title="Metode Penyamaran" size="sm">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        Masuk sebagai <strong>{account.nama}</strong> ({roleLabel}) pada divisi
        yang dipilih.
      </p>
      <div className="mt-4">
        <Field label="Divisi Tujuan">
          <Select
            value={divisiId}
            disabled={saving}
            onChange={(e) => setDivisiId(e.target.value)}
            aria-label="Divisi Tujuan"
          >
            <option value="">Pilih divisi</option>
            {divisions.map((d) => (
              <option key={d.divisiId} value={d.divisiId}>
                {formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={onClose}
        >
          Batal
        </Button>
        <Button
          type="button"
          loading={saving}
          disabled={saving || !divisiId}
          onClick={handleMasuk}
        >
          Masuk
        </Button>
      </div>
    </Modal>
  );
}

function ImpersonationConfirmModal({
  account,
  onClose,
}: {
  account: AccountRow;
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const roleLabel = ROLE_LABELS[account.role as Role] ?? account.role;

  function handleMasuk() {
    startTransition(async () => {
      const result = await startImpersonationAction({ accountId: account.id });
      if (!result.ok) {
        error(result.message);
        return;
      }
      success(result.message);
      onClose();
      router.push("/dashboard");
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Konfirmasi Mode Penyamaran"
      size="sm"
    >
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        Apakah Anda ingin masuk mode penyamaran sebagai akun{" "}
        <strong>{account.nama}</strong> dengan role{" "}
        <strong>{roleLabel}</strong>?
      </p>
      {account.email !== "—" && (
        <p className="mt-2 text-xs text-muted-foreground">{account.email}</p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={onClose}
        >
          Batal
        </Button>
        <Button
          type="button"
          loading={saving}
          disabled={saving}
          onClick={handleMasuk}
        >
          Masuk
        </Button>
      </div>
    </Modal>
  );
}

function IconButton({
  children,
  label,
  title,
  tone = "default",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  title: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "danger"
      ? "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
      : "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={`tap-target inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function EditAccountModal({
  account,
  onClose,
}: {
  account: AccountRow;
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [nama, setNama] = useState(account.nama === "—" ? "" : account.nama);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const valid = nama.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!nama.trim()) {
      setFormError("Nama akun tidak boleh kosong.");
      return;
    }

    setSaving(true);
    const fd = new FormData();
    fd.set("user_id", account.id);
    fd.set("nama", nama.trim());

    const result = await updateAccountNameAction(fd);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.message);
      error(result.message);
      return;
    }

    success(result.message);
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Ubah Akun" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama">
          <Input
            value={nama}
            maxLength={120}
            disabled={saving}
            onChange={(e) => {
              setNama(e.target.value);
              if (formError) setFormError("");
            }}
          />
        </Field>
        <Field label="Email">
          <Input value={account.email} disabled readOnly />
        </Field>
        <Field label="Role">
          <Input
            value={ROLE_LABELS[account.role as Role] ?? account.role}
            disabled
            readOnly
          />
        </Field>
        <Field label="Periode">
          <Input value={account.periodeNama} disabled readOnly />
        </Field>

        {formError && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={onClose}
          >
            Batal
          </Button>
          <Button type="submit" disabled={!valid} loading={saving}>
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditDivisiModal({
  division,
  periods,
  onClose,
}: {
  division: DivisionRow;
  periods: PeriodOption[];
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [nomor, setNomor] = useState(String(division.nomorDivisi));
  const [nama, setNama] = useState(division.namaDivisi);
  const [periodeId, setPeriodeId] = useState(division.periodeId);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const nomorNum = Number(nomor);
  const valid =
    Number.isInteger(nomorNum) &&
    nomorNum >= 1 &&
    nama.trim().length > 0 &&
    !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!Number.isInteger(nomorNum) || nomorNum < 1) {
      setFormError("Nomor divisi harus berupa angka lebih dari 0.");
      return;
    }
    if (!nama.trim()) {
      setFormError("Nama divisi tidak boleh kosong.");
      return;
    }

    setSaving(true);
    const fd = new FormData();
    fd.set("divisi_id", division.divisiId);
    fd.set("nomor_divisi", String(nomorNum));
    fd.set("nama_divisi", nama.trim());
    fd.set("periode_id", periodeId);

    const result = await updateDivisiAction(fd);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.message);
      error(result.message);
      return;
    }

    success(result.message);
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Ubah Divisi" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nomor / Kode">
          <Input
            type="number"
            min={1}
            value={nomor}
            disabled={saving}
            onChange={(e) => {
              setNomor(e.target.value);
              if (formError) setFormError("");
            }}
          />
        </Field>
        <Field label="Nama Divisi">
          <Input
            value={nama}
            maxLength={120}
            disabled={saving}
            onChange={(e) => {
              setNama(e.target.value);
              if (formError) setFormError("");
            }}
          />
        </Field>
        <Field label="Periode">
          <Select
            value={periodeId}
            disabled={saving}
            onChange={(e) => setPeriodeId(e.target.value)}
          >
            <option value="">— Tanpa periode —</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.namaPeriode}
              </option>
            ))}
          </Select>
        </Field>

        {formError && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={!valid} loading={saving}>
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AccountPasswordModal({
  account,
  onClose,
}: {
  account: AccountRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function gagalValidasi(message: string) {
    setFormError(message);
    error(message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      gagalValidasi(
        `Password akun minimal ${MIN_ACCOUNT_PASSWORD_LENGTH} karakter.`
      );
      return;
    }
    if (password.length > 128) {
      gagalValidasi("Password akun maksimal 128 karakter.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      gagalValidasi("Password akun harus memiliki kombinasi huruf dan angka.");
      return;
    }
    if (password !== confirmPassword) {
      gagalValidasi("Konfirmasi password tidak cocok.");
      return;
    }

    setSaving(true);
    const fd = new FormData();
    fd.set("user_id", account.id);
    fd.set("password", password);
    fd.set("confirm_password", confirmPassword);

    try {
      const result = await setAccountPasswordAction(fd);

      if (!result.ok) {
        setFormError(result.message);
        error(result.message);
        return;
      }

      success(result.message);
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Ubah Password Akun" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="font-medium">{account.nama}</p>
          <p className="text-xs text-muted-foreground">{account.email}</p>
          <div className="mt-1.5">
            <Badge color="blue">
              {ROLE_LABELS[account.role as Role] ?? account.role}
            </Badge>
          </div>
        </div>

        <Field label="Password Baru">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              maxLength={128}
              required
              autoComplete="new-password"
              placeholder="Masukkan password baru"
              disabled={saving}
              className="pr-10"
              onChange={(e) => {
                setPassword(e.target.value);
                if (formError) setFormError("");
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>

        <Field label="Konfirmasi Password Baru">
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              maxLength={128}
              required
              autoComplete="new-password"
              placeholder="Ulangi password baru"
              disabled={saving}
              className="pr-10"
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (formError) setFormError("");
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={
                showConfirmPassword
                  ? "Sembunyikan konfirmasi password"
                  : "Tampilkan konfirmasi password"
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>

               {formError && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            <KeyRound className="h-4 w-4" />
            <span>Ubah Password</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({
  division,
  periods,
  onClose,
}: {
  division: DivisionRow;
  periods: PeriodOption[];
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const [periodeId, setPeriodeId] = useState(
    division.periodeId || periods.find((p) => p.status === "active")?.id || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const sudahDiatur = division.hasPassword;
  const terakhirDiubah = formatWaktu(division.updatedAt);

  function gagalValidasi(message: string) {
    setFormError(message);
    error(message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      gagalValidasi(`Password divisi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }

    setSaving(true);
    const fd = new FormData();
    fd.set("divisi_id", division.divisiId);
    fd.set("password", password);
    fd.set("periode_id", periodeId);

    try {
      const result = await setDivisionPasswordAction(fd);

      if (!result.ok) {
        setFormError(result.message);
        error(result.message);
        return;
      }

      success(result.message);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Atur Password Divisi" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="font-medium">
            {formatDivisiLabel(division.nomorDivisi, division.namaDivisi)}
          </p>
          <div className="mt-1.5">
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
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Masukkan password baru"
              disabled={saving}
              className="pr-10"
              onChange={(e) => {
                setPassword(e.target.value);
                if (formError) setFormError("");
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>

        <Field label="Periode">
          <Select
            value={periodeId}
            onChange={(e) => setPeriodeId(e.target.value)}
            disabled={saving}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.namaPeriode}
              </option>
            ))}
          </Select>
        </Field>

        {formError && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            {sudahDiatur ? (
              <KeyRound className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{sudahDiatur ? "Ubah Password" : "Simpan Password"}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TambahDivisiModal({
  periods,
  existingNomor,
  onClose,
}: {
  periods: PeriodOption[];
  existingNomor: number[];
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [nomor, setNomor] = useState("");
  const [nama, setNama] = useState("");
  const [periodeId, setPeriodeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const nomorNum = Number(nomor);
  const nomorDuplikat =
    Number.isInteger(nomorNum) && existingNomor.includes(nomorNum);
  const valid =
    Number.isInteger(nomorNum) &&
    nomorNum >= 1 &&
    nama.trim().length > 0 &&
    !nomorDuplikat &&
    !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!Number.isInteger(nomorNum) || nomorNum < 1) {
      setFormError("Nomor divisi harus berupa angka lebih dari 0.");
      return;
    }
    if (nomorDuplikat) {
      setFormError(`Nomor divisi ${nomorNum} sudah dipakai.`);
      return;
    }
    if (!nama.trim()) {
      setFormError("Nama divisi tidak boleh kosong.");
      return;
    }

    setSaving(true);
    const fd = new FormData();
    fd.set("nomor_divisi", String(nomorNum));
    fd.set("nama_divisi", nama.trim());
    fd.set("periode_id", periodeId);

    const result = await createDivisiAction(fd);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.message);
      error(result.message);
      return;
    }

    success(result.message);
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Tambah Divisi" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Nomor / Kode"
          error={nomorDuplikat ? `Nomor ${nomorNum} sudah dipakai.` : undefined}
        >
          <Input
            type="number"
            min={1}
            value={nomor}
            placeholder="mis. 9"
            disabled={saving}
            onChange={(e) => {
              setNomor(e.target.value);
              if (formError) setFormError("");
            }}
          />
        </Field>
        <Field label="Nama Divisi">
          <Input
            value={nama}
            maxLength={120}
            placeholder="mis. Divisi Dokumentasi"
            disabled={saving}
            onChange={(e) => {
              setNama(e.target.value);
              if (formError) setFormError("");
            }}
          />
        </Field>
        <Field label="Periode (opsional)">
          <Select
            value={periodeId}
            onChange={(e) => setPeriodeId(e.target.value)}
            disabled={saving}
          >
            <option value="">— Tanpa periode —</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.namaPeriode}
              </option>
            ))}
          </Select>
        </Field>

        {formError && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={!valid} loading={saving} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Simpan Divisi</span>
          </Button>
        </div>
      </form>
    </Modal>
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
