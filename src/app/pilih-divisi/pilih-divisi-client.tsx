"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, KeyRound, Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { clearDivisionTokenCookie } from "@/lib/division-session-client";
import {
  endDivisionSessionAction,
  startDivisionSessionAction,
} from "./actions";

export interface DivisiOpsi {
  id: string;
  nomorDivisi: number;
  namaDivisi: string;
}

interface PilihDivisiClientProps {
  divisi: DivisiOpsi[];
  activeDivisiId: string | null;
}

export function PilihDivisiClient({ divisi, activeDivisiId }: PilihDivisiClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [selected, setSelected] = useState<DivisiOpsi | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setError(null);
    setLoading(true);

    const result = await startDivisionSessionAction(selected.id, password);

    setLoading(false);

    if (!result.ok) {
      setError(result.message ?? "Gagal masuk ke divisi.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGantiDivisi() {
    setLeaving(true);
    await endDivisionSessionAction();
    setSelected(null);
    setPassword("");
    setLeaving(false);
    router.refresh();
  }

  async function handleLogout() {
    clearDivisionTokenCookie();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8 bg-slate-50 dark:bg-slate-950">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            Portal Divisi
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            {selected ? selected.namaDivisi : "Pilih Divisi"}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {selected
              ? "Masukkan password divisi untuk melanjutkan."
              : "Pilih divisi yang ingin dikelola."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 shadow-card p-6 md:p-8">
          {selected ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Divisi {String(selected.nomorDivisi).padStart(2, "0")} —{" "}
                    {selected.namaDivisi}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Divisi {String(selected.nomorDivisi).padStart(2, "0")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected(null);
                    setPassword("");
                    setError(null);
                  }}
                  disabled={loading}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Ubah
                </Button>
              </div>

              <div>
                <label
                  htmlFor="password-divisi"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Password Divisi
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password-divisi"
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    autoComplete="off"
                    placeholder="Password/kode divisi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-10 py-3 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-brand-500 dark:focus:ring-brand-500/10 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  {showPassword ? "Sembunyikan password" : "Tampilkan password"}
                </button>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-900/20 dark:text-rose-300"
                  role="alert"
                >
                  <span className="font-bold">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" size="lg" loading={loading} className="w-full h-12 text-sm font-semibold">
                <span>{loading ? "Memverifikasi..." : "Masuk ke Dashboard Divisi"}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <div>
              {activeDivisiId && (
                <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Anda sedang mengelola{" "}
                    <span className="font-semibold">
                      {divisi.find((d) => d.id === activeDivisiId)?.namaDivisi ??
                        "sebuah divisi"}
                    </span>
                    .
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGantiDivisi}
                    loading={leaving}
                    className="shrink-0"
                  >
                    Ganti Divisi
                  </Button>
                </div>
              )}

              {divisi.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  Belum ada data divisi.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {divisi.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelected(d);
                        setPassword("");
                        setError(null);
                      }}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-brand-500 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-slate-950"
                    >
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Divisi{" "}
                          {String(d.nomorDivisi).padStart(2, "0")}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {d.namaDivisi}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                    </button>
                  ))}
                </div>
              )}

              {activeDivisiId && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => router.push("/dashboard")}
                  className="mt-5 w-full"
                >
                  <Check className="h-4 w-4" />
                  Kembali ke Dashboard
                </Button>
              )}
            </div>
          )}
        </div>

<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-400 dark:text-slate-500"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar dari akun
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <KeyRound className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          <span>Akses dilindungi password divisi</span>
        </div>
      </div>
    </div>
  );
}
