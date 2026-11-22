"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { formatDivisiLabel } from "@/lib/divisi-options";
import {
  TablePagination,
  usePagination,
} from "@/components/ui/pagination";
import { setDivisiPeriodAction } from "../../actions/periode-actions";

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

export function AdminDivisiClient({
  divisi,
  periods,
}: {
  divisi: DivisiRow[];
  periods: PeriodOption[];
}) {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const pagination = usePagination(divisi.length);
  const visibleDivisi = pagination.showAll
    ? divisi
    : divisi.slice(
        (pagination.page - 1) * pagination.pageSize,
        pagination.page * pagination.pageSize
      );

  function handle(divisiId: string, periodeId: string) {
    setChoices((prev) => ({ ...prev, [divisiId]: periodeId }));
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
    <>
      <TableWrap>
      <THead>
        <TR>
          <TH>Divisi</TH>
          <TH className="text-right">Periode</TH>
        </TR>
      </THead>
      <TBody>
        {visibleDivisi.map((d) => (
          <TR key={d.id}>
            <TD className="font-medium">
              {formatDivisiLabel(d.nomorDivisi, d.namaDivisi)}
            </TD>
            <TD className="text-right">
              <Select
                className="ml-auto w-auto"
                value={choices[d.id] ?? ""}
                disabled={pending}
                onChange={(e) => handle(d.id, e.target.value)}
              >
                <option value="">Belum ditentukan</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPeriode}
                  </option>
                ))}
              </Select>
            </TD>
          </TR>
        ))}
        {visibleDivisi.length === 0 && (
          <TR>
            <TD colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
              Belum ada divisi.
            </TD>
          </TR>
        )}
      </TBody>
    </TableWrap>
    <TablePagination
      total={divisi.length}
      page={pagination.page}
      pageCount={pagination.pageCount}
      showAll={pagination.showAll}
      start={pagination.start}
      end={pagination.end}
      label="divisi"
      onPageChange={pagination.goTo}
      onToggleAll={pagination.toggleShowAll}
    />
    </>
  );
}
