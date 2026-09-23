import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
      {children}
    </label>
  );
}

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, error, hint, children }: FieldWrapperProps) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  );
}

const baseInput =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${baseInput} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${baseInput} min-h-[90px] resize-y ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${baseInput} cursor-pointer ${className}`} {...props}>
      {children}
    </select>
  );
}

