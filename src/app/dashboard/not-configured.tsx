"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NotConfigured() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">Akun belum dikonfigurasi</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Akun Anda telah terhubung, tetapi belum memiliki peran (<code>role</code>) dan divisi (
          <code>divisi_id</code>).
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Hubungi admin untuk menetapkan peran Anda di tabel{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">profiles</code>, lalu muat
          ulang halaman ini.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Keluar
          </button>
          <Link
            href="/"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}