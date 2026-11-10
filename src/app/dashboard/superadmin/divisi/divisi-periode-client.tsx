"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import {
  createDivisiAction,
  deleteDivisiAction,
  setDivisiPeriodAction,
  updateDivisiAction,
} from "../../actions/periode-actions";

interface DivisiRow {
  id: string;
  nomorDivisi: number;
  namaDivisi: string;
  periodeId: string;
}

interface PeriodOption {
  id: string;
  namaPeriode: string;
  status: "active" | "archived" | "inactive";
}

export function DivisiPeriodeClient({
  divisi,
  periods,
}: {
  divisi: DivisiRow[];
  periods: PeriodOption[];
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState<DivisiRow | null>(null);
  const [periodeByDivisi, setPeriodeByDivisi] = useState<Record<string, string>>(
    () => Object.fromEntries(divisi.map((d) => [d.id, d.periodeId]))
  );

  useEffect(() => {
    setPeriodeByDivisi(Object.fromEntries(divisi.map((d) => [d.id, d.periodeId])));
  }, [divisi]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const visible = useMemo(() => {
    if (!debounced) return divisi;
    return divisi.filter(
      (d) =>
        String(d.nomorDivisi).includes(debounced) ||
        d.namaDivisi.toLowerCase().includes(debounced)
    );
  }, [divisi, debounced]);

  function handlePeriode(divisiId: string, periodeId: string) {
    setPeriodeByDivisi((prev) => ({ ...prev, [divisiId]: periodeId }));
    const fd = new FormData();
    fd.set("divisi_id", divisiId);
    fd.set("periode_id", periodeId);
    startTransition(async () => {
      const result = await setDivisiPeriodAction(fd);
      if (result.ok) {
        success(result.message);
      } else {
        error(result.message);
        router.refresh();
      }
    });
  }

  function handleDelete(d: DivisiRow) {
    const label = `Divisi ${String(d.nomorDivisi).padStart(2, "0")} — ${d.namaDivisi}`;
    if (
      !window.confirm(
        `Hapus ${label}?\n\nData terkait divisi ini (anggota, kredensial, laporan) dapat ikut terhapus dan tidak bisa dikembalikan.`
      )
    ) {
      return;
    }

    const fd = new FormData();
    fd.set("divisi_id", d.id);
    startTransition(async () => {
      const result = await deleteDivisiAction(fd);
      if (result.ok) {
        success(result.message);
        router.refresh();
      } else {
        error(result.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <TambahDivisiForm
        periods={periods}
        disabled={pending}
        existingNomor={divisi.map((d) => d.nomorDivisi)}
        onDone={() => router.refresh()}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor atau nama divisi..."
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {visible.length} dari {divisi.length} divisi
        </span>
      </div>

      <TableWrap minWidth={640}>
        <THead>
          <TR>
            <TH>Divisi</TH>
            <TH>Nama</TH>
            <TH>Periode</TH>
            <TH className="text-right">Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {visible.map((d) => (
            <TR key={d.id}>
              <TD className="font-medium">{d.nomorDivisi}</TD>
              <TD>{d.namaDivisi}</TD>
              <TD>
                <Select
                  className="w-auto"
                  value={periodeByDivisi[d.id] ?? ""}
                  disabled={pending}
                  onChange={(e) => handlePeriode(d.id, e.target.value)}
                >
                  <option value="">Belum ditentukan</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.namaPeriode}
                    </option>
                  ))}
                </Select>
              </TD>
              <TD className="whitespace-nowrap text-right">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(d)}
                    disabled={pending}
                    title="Ubah data divisi"
                    aria-label={`Ubah ${d.namaDivisi}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(d)}
                    disabled={pending}
                    title="Hapus divisi"
                    aria-label={`Hapus ${d.namaDivisi}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </TD>
            </TR>
          ))}
          {visible.length === 0 && (
            <TR>
              <TD colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                {debounced
                  ? "Tidak ada divisi yang cocok dengan pencarian."
                  : "Belum ada divisi."}
              </TD>
            </TR>
          )}
        </TBody>
      </TableWrap>

      {editing && (
        <EditDivisiModal
          key={editing.id}
          divisi={editing}
          periods={periods}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditDivisiModal({
  divisi,
  periods,
  onClose,
}: {
  divisi: DivisiRow;
  periods: PeriodOption[];
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const router = useRouter();
  const [nomor, setNomor] = useState(String(divisi.nomorDivisi));
  const [nama, setNama] = useState(divisi.namaDivisi);
  const [periodeId, setPeriodeId] = useState(divisi.periodeId);
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
    fd.set("divisi_id", divisi.id);
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

function TambahDivisiForm({
  periods,
  disabled,
  existingNomor,
  onDone,
}: {
  periods: PeriodOption[];
  disabled: boolean;
  existingNomor: number[];
  onDone: () => void;
}) {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
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
    !saving &&
    !disabled;

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
    setNomor("");
    setNama("");
    setPeriodeId("");
    setOpen(false);
    onDone();
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        <span>Tambah Divisi</span>
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Tambah Divisi"
        subtitle="Isi nomor/kode dan nama divisi. Nomor dan nama tidak boleh duplikat."
        icon={<Building2 className="h-5 w-5" />}
      />
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Nomor / Kode"
            error={nomorDuplikat ? `Nomor ${nomorNum} sudah dipakai.` : undefined}
          >
            <Input
              type="number"
              min={1}
              value={nomor}
              placeholder="mis. 9"
              disabled={saving || disabled}
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
              disabled={saving || disabled}
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
              disabled={saving || disabled}
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
            <p className="sm:col-span-3 text-xs font-medium text-rose-600 dark:text-rose-400">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-2 sm:col-span-3">
            <Button type="submit" disabled={!valid} loading={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              <span>Simpan Divisi</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving || disabled}
              onClick={() => {
                setOpen(false);
                setFormError("");
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
