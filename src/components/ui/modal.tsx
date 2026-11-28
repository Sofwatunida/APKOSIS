"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const sizes: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 animate-fade-in sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative w-full min-w-0 ${sizes[size]} max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-elevated border border-slate-200/80 animate-slide-up dark:bg-slate-900 dark:border-slate-800/80 dark:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] sm:max-h-[90vh]`}
      >
        <div className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-3 border-b border-slate-100/90 bg-white/95 px-4 py-4 backdrop-blur-sm dark:border-slate-800/90 dark:bg-slate-900/95 sm:px-6 sm:py-4.5">
          <h3 className="min-w-0 break-words text-base font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="tap-target shrink-0 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-w-0 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

