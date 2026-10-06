import type { CSSProperties, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Pembungkus tabel seragam untuk semua role.
 *
 * - `w-full min-w-0` menjaga wrapper tetap mengikuti lebar container sehingga
 *   tabel tidak ikut melebar keluar viewport.
 * - `overflow-x-auto` membuat tabel yang lebih lebar dari layar bisa digeser
 *   horizontal (struktur kolom tetap utuh, tidak dipaksa mengecil).
 * - `maxHeight` (opsional) mengaktifkan scroll vertikal bila isi tabel sangat
 *   banyak baris, sehingga halaman utama tidak ikut memanjang.
 * - `minWidth` adalah lebar minimum tabel: kolom tetap terbaca, teks tidak
 *   turun satu huruf per baris.
 */
export function TableWrap({
  children,
  className = "",
  minWidth = 640,
  maxHeight,
}: {
  children: ReactNode;
  className?: string;
  minWidth?: number;
  /** mis. "70vh" atau "600px" untuk mengaktifkan scroll vertikal */
  maxHeight?: number | string;
}) {
  const tableStyle: CSSProperties = { minWidth };

  return (
    <div
      className={`w-full min-w-0 overflow-x-auto ${maxHeight ? "overflow-y-auto" : ""} ${className}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <div className="min-w-full">
        <table className="table-shell w-full" style={tableStyle}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="table-head">{children}</thead>;
}

export function TH({
  children,
  align = "left",
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={`table-head-cell ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">{children}</tbody>;
}

export function TR({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={`table-row ${className}`}>{children}</tr>;
}

export function TD({
  children,
  align = "left",
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={`table-cell ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}
