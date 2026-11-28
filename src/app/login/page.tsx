"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Tidak dapat masuk. Periksa kembali email dan password Anda.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <ToastProvider>
      <div className="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-slate-50 px-4 py-8 selection:bg-brand-500 selection:text-white dark:bg-slate-950 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_45%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_45%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.1),transparent_40%)]" />

        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-[420px] animate-fade-in">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-2 inline-flex items-center rounded-full border border-brand-200/90 bg-white/100 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-brand-700 shadow-sm backdrop-blur dark:border-brand-500/20 dark:bg-slate-900/70 dark:text-brand-300">
              APKOSIS
            </div>
      
          
          </div>

          <div className="min-w-0 rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.2)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_20px_60px_-24px_rgba(0,0,0,0.55)] sm:p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="nama@sekolah.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-12 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="tap-target absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300 sm:pr-4"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{error}</span>
                </div>
              )}

              <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-semibold" size="lg" loading={loading}>
                {loading ? "Memverifikasi..." : "Masuk"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}