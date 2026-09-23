"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { Sparkles, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";

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
      <div className="relative min-h-screen flex items-center justify-center p-4 bg-slate-950 overflow-hidden selection:bg-brand-500 selection:text-white">
        {/* Modern Aurora / Mesh Gradient Background Elements */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-brand-600/30 via-indigo-500/20 to-purple-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 right-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-emerald-500/15 via-indigo-600/10 to-transparent blur-[100px]" />

        <div className="relative w-full max-w-md animate-slide-up">
          {/* Brand Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-glow ring-4 ring-white/10">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-brand-300 backdrop-blur-md mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
              Sistem Portal OSIS Modern 2026
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              APKOSIS
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Aplikasi Pencatatan & Monitoring Laporan Harian OSIS
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-8 shadow-elevated backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-lg font-bold tracking-tight text-white">
                Masuk ke Akun Anda
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Silakan masukkan kredensial yang telah didaftarkan.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4.5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="nama@sekolah.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs transition hover:border-slate-700 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs transition hover:border-slate-700 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition"
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
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <span className="font-bold">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold shadow-lg shadow-brand-600/30 gap-2"
                size="lg"
                loading={loading}
              >
                <span>{loading ? "Memverifikasi..." : "Masuk ke Dashboard"}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Akses terproteksi & terenkripsi</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            APKOSIS &copy; 2026 • Sistem Manajemen & Akuntabilitas OSIS
          </p>
        </div>
      </div>
    </ToastProvider>
  );
}

