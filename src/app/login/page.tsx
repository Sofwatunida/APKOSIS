"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
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
      <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8 bg-slate-50 dark:bg-slate-950 overflow-hidden selection:bg-brand-500 selection:text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-500/5 via-transparent to-indigo-500/5 dark:from-brand-500/10 dark:via-transparent dark:to-indigo-500/10" />

        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm animate-fade-in">
          {/* Brand Header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 mb-5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
              Portal OSIS Modern
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              APKOSIS
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Aplikasi Pencatatan & Monitoring Laporan Harian OSIS
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 shadow-card dark:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] backdrop-blur-sm p-6 md:p-8">
            <div className="mb-8">
              <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                Masuk ke Akun Anda
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Silakan masukkan kredensial yang telah didaftarkan.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="nama@sekolah.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-10 pr-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-brand-500 dark:focus:ring-brand-500/10 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-10 pr-12 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-brand-500 dark:focus:ring-brand-500/10 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition dark:hover:text-slate-300"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-900/20 dark:text-rose-300" role="alert">
                  <span className="font-bold">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-sm font-semibold gap-2"
                size="lg"
                loading={loading}
              >
                <span>{loading ? "Memverifikasi..." : "Masuk ke Dashboard"}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Akses terproteksi & terenkripsi</span>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
            APKOSIS &copy; 2026 &middot; Sistem Manajemen & Akuntabilitas OSIS
          </p>
        </div>
      </div>
    </ToastProvider>
  );
}