import { Loader2, Inbox, AlertTriangle, RefreshCw } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="relative flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
        <div className="absolute inset-0 rounded-full blur-xs bg-brand-400/20" />
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100/90 text-slate-400 ring-1 ring-slate-200/60 shadow-xs">
        <Inbox className="h-7 w-7 stroke-[1.5]" />
      </div>
      <p className="text-sm font-semibold tracking-tight text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 shadow-xs">
        <AlertTriangle className="h-7 w-7 stroke-[1.5]" />
      </div>
      <p className="text-sm font-semibold tracking-tight text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Coba lagi
        </button>
      )}
    </div>
  );
}

