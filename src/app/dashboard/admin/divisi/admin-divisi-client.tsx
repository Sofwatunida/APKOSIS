"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
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
    <TableWrap>
      <THead>
        <TR>
          <TH>Divisi</TH>
          <TH>Nama</TH>
          <TH className="text-right">Periode</TH>
        </TR>
      </THead>
      <TBody>
        {divisi.map((d) => (
          <TR key={d.id}>
            <TD className="font-medium">{d.nomorDivisi}</TD>
            <TD>{d.namaDivisi}</TD>
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
      </TBody>
    </TableWrap>
  );
}
