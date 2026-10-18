"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import {
  createDivisiAction,
  setDivisiPeriodAction,
} from "../../actions/periode-actions";

interface DivisiRow {
  id: string;
  nomorDivisi: number;
  namaDivisi: string;
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
    const fd = new FormData();
    fd.set("divisi_id", divisiId);
    fd.set("periode_id", periodeId);
    startTransition(async () => {
      const result = await setDivisiPeriodAction(fd);
      if (result.ok) success(result.message);
      else error(result.message);
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

      <TableWrap minWidth={560}>
        <THead>
          <TR>
            <TH>Divisi</TH>
            <TH>Nama</TH>
            <TH className="text-right">Periode</TH>
          </TR>
        </THead>
        <TBody>
          {visible.map((d) => (
            <TR key={d.id}>
              <TD className="font-medium">{d.nomorDivisi}</TD>
              <TD>{d.namaDivisi}</TD>
              <TD className="text-right">
                <Select
                  className="ml-auto w-auto"
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => {
                    handlePeriode(d.id, e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="" disabled>
                    Pilih periode...
                  </option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.namaPeriode}
                    </option>
                  ))}
                </Select>
              </TD>
            </TR>
          ))}
          {visible.length === 0 && (
            <TR>
              <TD colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                {debounced
                  ? "Tidak ada divisi yang cocok dengan pencarian."
                  : "Belum ada divisi."}
              </TD>
            </TR>
          )}
        </TBody>
      </TableWrap>
    </div>
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
