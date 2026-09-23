import type { ReactNode } from "react";

export function Badge({
  children,
  color = "slate",
  dot = true,
  className = "",
}: {
  children: ReactNode;
  color?: "green" | "red" | "slate" | "amber" | "blue" | "indigo";
  dot?: boolean;
  className?: string;
}) {
  const configs: Record<string, { badge: string; dot: string }> = {
    green: {
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
      dot: "bg-emerald-500",
    },
    red: {
      badge: "bg-rose-50 text-rose-700 ring-rose-600/20",
      dot: "bg-rose-500",
    },
    slate: {
      badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
      dot: "bg-slate-400",
    },
    amber: {
      badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
      dot: "bg-amber-500",
    },
    blue: {
      badge: "bg-sky-50 text-sky-700 ring-sky-600/20",
      dot: "bg-sky-500",
    },
    indigo: {
      badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
      dot: "bg-indigo-500",
    },
  };

  const current = configs[color] || configs.slate;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${current.badge} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${current.dot}`} />}
      {children}
    </span>
  );
}

