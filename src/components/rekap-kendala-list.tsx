import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/date";
import type { ExportColumn } from "@/lib/export-client";

export const KENDALA_KOSONG = "Tidak ada kendala yang dilaporkan";
export const SOLUSI_KOSONG = "Belum ada solusi";

export interface RekapKendalaItem {
  id?: string;
  tanggal: string;
  divisi: string;
  kendala: string;
  solusi: string;
}

export const REKAP_KENDALA_COLUMNS: ExportColumn[] = [
  { header: "No", key: "no", width: 6 },
  { header: "Tanggal", key: "tanggal", width: 16 },
  { header: "Divisi", key: "divisi", width: 18 },
  { header: "Kendala", key: "kendala", width: 30 },
  { header: "Solusi", key: "solusi", width: 30 },
];

export function buildRekapKendalaRows(items: RekapKendalaItem[]) {
  return items.map((item, index) => ({
    no: index + 1,
    tanggal: formatDate(item.tanggal),
    divisi: item.divisi || "-",
    kendala: item.kendala?.trim() || KENDALA_KOSONG,
    solusi: item.solusi?.trim() || SOLUSI_KOSONG,
  }));
}

export function RekapKendalaList({
  items,
  emptyTitle = "Tidak ada kendala pada periode ini",
  emptyDescription,
}: {
  items: RekapKendalaItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const rows = buildRekapKendalaRows(items);

  return (
    <TableWrap minWidth={760}>
      <THead>
        <tr>
          <TH align="center" className="w-14">No</TH>
          <TH className="w-36">Tanggal</TH>
          <TH className="w-48">Divisi</TH>
          <TH>Kendala</TH>
          <TH>Solusi</TH>
        </tr>
      </THead>
      <TBody>
        {rows.map((row, index) => {
          const item = items[index];
          return (
            <TR key={item.id ?? `${item.tanggal}-${item.divisi}-${index}`}>
              <TD align="center" className="whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400">
                {row.no}
              </TD>
              <TD className="whitespace-nowrap text-slate-600 dark:text-slate-300">
                {row.tanggal}
              </TD>
              <TD className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                {row.divisi}
              </TD>
              <TD className="min-w-0 break-words text-slate-700 dark:text-slate-200">
                {row.kendala}
              </TD>
              <TD className="min-w-0 break-words text-slate-600 dark:text-slate-300">
                {row.solusi}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </TableWrap>
  );
}
