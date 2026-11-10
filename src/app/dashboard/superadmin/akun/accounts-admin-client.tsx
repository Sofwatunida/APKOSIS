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
import { ROLE_LABELS } from "@/lib/role";
import type { Role } from "@/lib/types";
import {
  assignAdminAction,
  createDivisiAction,
  deleteAccountAction,
  deleteDivisiAction,
  setDivisionPasswordAction,
  setDivisiPeriodAction,
  setUserRoleAction,
  updateAccountNameAction,
  updateDivisiAction,
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

type IntegratedRow =
  | { kind: "account"; account: AccountRow; division: DivisionRow | null }
  | { kind: "division"; division: DivisionRow };

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
  const [periodeFilter, setPeriodeFilter] = useState(selectedPeriodeId);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [editingDivision, setEditingDivision] = useState<DivisionRow | null>(null);
  const [passwordDivision, setPasswordDivision] = useState<DivisionRow | null>(null);
  const [addingDivision, setAddingDivision] = useState(false);

  // Debounce pencarian realtime (nama / email / role / divisi).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const divisionById = useMemo(
    () => new Map<string, DivisionRow>(divisions.map((d) => [d.divisiId, d])),
    [divisions]
  );

  // Satu baris = satu akun. Divisi yang belum punya akun tetap muncul
  // sebagai baris tersendiri supaya tetap bisa dikelola dari tabel ini.
  const integratedRows = useMemo<IntegratedRow[]>(() => {
    const rows: IntegratedRow[] = [];
    const linkedDivisions = new Set<string>();

    for (const account of accounts) {
      const division = account.divisiId
        ? divisionById.get(account.divisiId) ?? null
        : null;
      if (division) linkedDivisions.add(division.divisiId);
      rows.push({ kind: "account", account, division });
    }

    for (const division of divisions) {
      if (!linkedDivisions.has(division.divisiId)) {
        rows.push({ kind: "division", division });
      }
    }

    return rows;
  }, [accounts, divisions, divisionById]);

  const visibleRows = useMemo(() => {
    return integratedRows.filter((row) => {
      const periodeId =
        row.kind === "account"
          ? row.division?.periodeId || row.account.periodeId
          : row.division.periodeId;

      if (periodeFilter && periodeId !== periodeFilter) return false;
      if (!debouncedSearch) return true;

      const parts =
        row.kind === "account"
          ? [
              row.account.nama,
              row.account.email,
              ROLE_LABELS[row.account.role as Role] ?? row.account.role,
              row.account.periodeNama,
              row.division?.namaDivisi ?? "",
              row.division ? String(row.division.nomorDivisi) : "",
              row.division?.periodeNama ?? "",
            ]
          : [
              row.division.namaDivisi,
              String(row.division.nomorDivisi),
              row.division.periodeNama,
            ];

      return parts.some((part) => part.toLowerCase().includes(debouncedSearch));
    });
  }, [integratedRows, periodeFilter, debouncedSearch]);

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
        `Hapus ${divisiLabel(division.nomorDivisi)} — ${division.namaDivisi}?\n\nData terkait divisi ini dapat ikut terhapus dan tidak bisa dikembalikan.`
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

      <Card>
        <CardHeader
          title={`Akun & Divisi (${visibleRows.length})`}
          subtitle="Satu tabel terpadu untuk akun, divisi, role, periode, dan kredensial."
          icon={<Users className="h-5 w-5" />}
          action={
            <>
              <ExportMenu
                title="APKOSIS — Pengelolaan Akun & Divisi"
                subtitle="Daftar konfigurasi password & periode setiap divisi"
                filename="pengelolaan-akun-divisi"
                columns={[
                  { header: "No", key: "no", width: 0.6, align: "center" },
                  { header: "Divisi", key: "divisi", width: 1.1 },
                  { header: "Nama Divisi", key: "nama", width: 2 },
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari akun, divisi, atau role..."
                className="pl-9"
                aria-label="Cari akun atau divisi"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Saring berdasarkan periode"
                value={periodeFilter}
                onChange={(e) => setPeriodeFilter(e.target.value)}
                className="w-auto"
              >
                <option value="">Seluruh periode</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPeriode}
                  </option>
                ))}
              </Select>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {visibleRows.length} baris
              </span>
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {debouncedSearch || periodeFilter
                ? "Tidak ada akun atau divisi yang cocok dengan filter."
                : "Belum ada data akun atau divisi."}
            </p>
          ) : (
            <TableWrap minWidth={880}>
              <THead>
                <TR>
                  <TH>Divisi</TH>
                  <TH>Akun</TH>
                  <TH>Role</TH>
                  <TH>Periode</TH>
                  <TH className="text-right">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {visibleRows.map((row) => {
                  if (row.kind === "division") {
                    const d = row.division;
                    return (
                      <TR key={`divisi-${d.divisiId}`}>
                        <TD>
                          <p className="font-medium">{divisiLabel(d.nomorDivisi)}</p>
                          <p className="text-xs text-muted-foreground">{d.namaDivisi}</p>
                        </TD>
                        <TD>
                          <span className="text-sm text-muted-foreground">
                            Belum ada akun
                          </span>
                        </TD>
                        <TD>
                          <span className="text-sm text-muted-foreground">—</span>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <Select
                            className="w-auto min-w-36"
                            value={d.periodeId}
                            disabled={pending}
                            aria-label={`Periode ${d.namaDivisi}`}
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
                              label={`Ubah ${d.namaDivisi}`}
                              title="Ubah divisi"
                              disabled={pending}
                              onClick={() => setEditingDivision(d)}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label={`Atur password ${d.namaDivisi}`}
                              title="Atur password"
                              disabled={pending}
                              onClick={() => setPasswordDivision(d)}
                            >
                              <KeyRound className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label={`Hapus ${d.namaDivisi}`}
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
                    );
                  }

                  const a = row.account;
                  const d = row.division;
                  const isSelf = a.id === currentUserId;
                  return (
                    <TR key={`akun-${a.id}`}>
                      <TD>
                        {d ? (
                          <>
                            <p className="font-medium">{divisiLabel(d.nomorDivisi)}</p>
                            <p className="text-xs text-muted-foreground">{d.namaDivisi}</p>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TD>
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
                            <IconButton
                              label={`Ubah ${a.nama}`}
                              title="Ubah akun"
                              disabled={pending}
                              onClick={() => setEditingAccount(a)}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            {d && (
                              <IconButton
                                label={`Atur password ${d.namaDivisi}`}
                                title="Atur password"
                                disabled={pending}
                                onClick={() => setPasswordDivision(d)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </IconButton>
                            )}
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
          )}
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
    </div>
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 ${toneClass}`}
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

        <p className="text-xs text-muted-foreground">
          Role dan periode dapat diubah langsung dari dropdown pada tabel.
        </p>

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
  const router = useRouter();
  const [periodeId, setPeriodeId] = useState(
    division.periodeId || periods.find((p) => p.status === "active")?.id || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const sudahDiatur = division.hasPassword;
  const terakhirDiubah = formatWaktu(division.updatedAt);
  const valid = password.length >= MIN_PASSWORD_LENGTH && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password divisi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }

    setSaving(true);
    const fd = new FormData();
    fd.set("divisi_id", division.divisiId);
    fd.set("password", password);
    fd.set("periode_id", periodeId);

    const result = await setDivisionPasswordAction(fd);
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
    <Modal open onClose={onClose} title="Atur Password Divisi" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="font-medium">
            {divisiLabel(division.nomorDivisi)} — {division.namaDivisi}
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
          <Button type="submit" disabled={!valid} loading={saving}>
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
