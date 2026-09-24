import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-sm shadow-brand-600/25 border border-brand-500/30 focus-visible:ring-brand-500/30 dark:from-brand-500 dark:to-indigo-500 dark:hover:from-brand-400 dark:hover:to-indigo-400 dark:shadow-brand-500/25 dark:border-brand-500/40",
  secondary:
    "bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/80 focus-visible:ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 dark:border-slate-700/80 dark:focus-visible:ring-slate-600",
  danger:
    "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-sm shadow-rose-600/20 border border-rose-500/30 focus-visible:ring-rose-500/30 dark:from-rose-500 dark:to-red-500 dark:hover:from-rose-400 dark:hover:to-red-400 dark:shadow-rose-500/20 dark:border-rose-500/40",
  ghost:
    "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 focus-visible:ring-slate-300 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50 dark:focus-visible:ring-slate-600",
  outline:
    "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs focus-visible:ring-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-600 dark:focus-visible:ring-slate-600",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-base rounded-xl gap-2.5",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin text-current" />
      )}
      {children}
    </button>
  );
}