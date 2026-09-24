"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const success = useCallback(
    (message: string) => toast(message, "success"),
    [toast]
  );
  const error = useCallback(
    (message: string) => toast(message, "error"),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 p-4 shadow-elevated dark:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] backdrop-blur-md animate-slide-up"
          >
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
              {t.type === "error" && (
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              )}
              {t.type === "info" && (
                <Info className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              )}
            </div>
            <p className="flex-1 text-xs font-medium leading-relaxed text-slate-800 dark:text-slate-100">
              {t.message}
            </p>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label="Tutup notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}