import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** Pembungkus tabel: mencegah tabel keluar dari viewport. */
export function TableWrap({
  children,
  className = "",
  minWidth = 640,
}: {
  children: ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <div className={`-mx-5 overflow-x-auto sm:mx-0 ${className}`}>
      <div className="min-w-full px-5 sm:px-0" style={{ minWidth: 0 }}>
        <table className="table-shell w-full" style={{ minWidth }}>
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
