"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ToastProvider } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError("Tidak dapat masuk. Periksa email dan password.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-700">
              APKOSIS
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Aplikasi Laporan Harian OSIS
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">
              Masuk ke akun Anda
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              Gunakan email dan password Supabase Anda.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {loading ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            APKOSIS &copy; 2026 - Sistem Monitoring Laporan Harian OSIS
          </p>
        </div>
      </div>
    </ToastProvider>
  );
}
