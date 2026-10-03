import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PeriodStatus } from "./database.types";
import { createClient } from "./supabase/server";
import { getProfile } from "./auth";
import type { Profile } from "./types";
import {
  ALL_PERIODS_VALUE,
  PERIOD_COOKIE,
  PERIOD_COOKIE_MAX_AGE_SECONDS,
} from "./period-constants";

export interface PeriodeOption {
  id: string;
  namaPeriode: string;
  tahunMulai: number;
  tahunSelesai: number;
  status: PeriodStatus;
}

export interface PeriodeContext {
  /** Periode yang sedang dipakai semua query. */
  selected: PeriodeOption;
  /** Semua periode yang boleh diakses user ini. */
  options: PeriodeOption[];
  /** null = hanya periode aktif, bukan mode "semua periode". */
  allPeriodsMode: boolean;
  /** true hanya untuk super_admin. */
  canSelectAllPeriods: boolean;
  /** true bila periode aktif tidak bisa ditambah/diubah datanya. */
  readOnly: boolean;
  canWrite: boolean;
}

function isSuperAdmin(profile: Profile | null): boolean {
  return profile?.role === "super_admin";
}

/**
 * SATU-SUMBER daftar periode.
 *
 * Semua dropdown periode di aplikasi (monitoring, bendahara,
 * sekretaris, admin, super admin, rekap, export) WAJIB memakai
 * fungsi ini. Jangan pernah membuat daftar tahun hardcoded.
 */
export const getPeriods = cache(async (): Promise<PeriodeOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("periods")
    .select("id, nama_periode, tahun_mulai, tahun_selesai, status")
    .order("tahun_mulai", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    namaPeriode: row.nama_periode,
    tahunMulai: row.tahun_mulai,
    tahunSelesai: row.tahun_selesai,
    status: row.status,
  }));
});

export const getActivePeriod = cache(async (): Promise<PeriodeOption | null> => {
  const periods = await getPeriods();
  return periods.find((p) => p.status === "active") ?? periods[0] ?? null;
});

/** Nilai mentah dari cookie (belum divalidasi). */
export async function getRawPeriodCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(PERIOD_COOKIE)?.value ?? null;
}

export async function setPeriodCookie(value: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PERIOD_COOKIE, value, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PERIOD_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearPeriodCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PERIOD_COOKIE);
}

/**
 * Menentukan periode yang dipakai halaman.
 *
 * Aturan:
 *  1. Cookie selalu divalidasi ulang ke tabel `periods`.
 *     Nilai yang tidak dikenal / tidak punya akses diabaikan.
 *  2. Tanpa cookie -> periode aktif (bukan `new Date().getFullYear()`).
 *  3. "Semua periode" hanya untuk super_admin.
 */
export const getPeriodeContext = cache(
  async (profile: Profile | null): Promise<PeriodeContext> => {
    const periods = await getPeriods();
    const active = periods.find((p) => p.status === "active") ?? periods[0] ?? null;

    const raw = await getRawPeriodCookie();
    const superAdmin = isSuperAdmin(profile);

    if (raw === ALL_PERIODS_VALUE && superAdmin) {
      return {
        selected: active ?? {
          id: "",
          namaPeriode: "Semua Periode",
          tahunMulai: 0,
          tahunSelesai: 0,
          status: "active",
        },
        options: periods,
        allPeriodsMode: true,
        canSelectAllPeriods: true,
        readOnly: false,
        canWrite: true,
      };
    }

    const fromCookie = raw ? periods.find((p) => p.id === raw) : null;
    const selected = fromCookie ?? active;

    if (!selected) {
      return {
        selected: {
          id: "",
          namaPeriode: "Belum ada periode",
          tahunMulai: 0,
          tahunSelesai: 0,
          status: "inactive",
        },
        options: [],
        allPeriodsMode: false,
        canSelectAllPeriods: superAdmin,
        readOnly: true,
        canWrite: false,
      };
    }

    // Admin hanya boleh Cruise satu periode yang ditugaskan kepadanya.
    // Tapi daftar periode tetap ditampilkan agar bisa berpindah view.
    return {
      selected,
      options: periods,
      allPeriodsMode: false,
      canSelectAllPeriods: superAdmin,
      readOnly: selected.status === "archived",
      canWrite: selected.status === "active",
    };
  }
);

/** Hanya id periode untuk query. null berarti mode "semua periode". */
export const getSelectedPeriodId = cache(async (): Promise<string | null> => {
  const profile = await getProfile();
  const ctx = await getPeriodeContext(profile);
  if (ctx.allPeriodsMode) return null;
  return ctx.selected.id || null;
});

/**
 * Menolak operasi tulis bila periode tujuan bukan periode aktif.
 * Melempar error, bukan redirect, karena dipanggil dari server action
 * dan client component alike.
 */
export function assertPeriodWritable(ctx: PeriodeContext): void {
  if (!ctx.canWrite) {
    throw new Error(
      ctx.readOnly
        ? `Periode ${ctx.selected.namaPeriode} sudah diarsipkan dan tidak bisa diubah.`
        : "Belum ada periode aktif."
    );
  }
}

export function assertPeriodWritableId(periodeId: string): void {
  if (!periodeId) throw new Error("Periode belum ditentukan.");
  if (periodeId === ALL_PERIODS_VALUE) {
    throw new Error("Pilih satu periode spesifik untuk menyimpan data.");
  }
}

/** Halaman yang butuh periode valid akan diarahkan ke dashboard. */
export async function requirePeriodContext(): Promise<PeriodeContext> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const ctx = await getPeriodeContext(profile);
  if (ctx.options.length === 0) redirect("/dashboard");
  return ctx;
}