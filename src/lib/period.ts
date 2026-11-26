import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PeriodStatus } from "./database.types";
import { createRawClient } from "./supabase/server";
import { getProfile } from "./auth";
import { isSuperAdmin } from "./role";
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
  /** true bila user boleh mengganti periode lewat UI/cookie. */
  canChangePeriod: boolean;
  /** true bila periode aktif tidak bisa ditambah/diubah datanya. */
  readOnly: boolean;
  canWrite: boolean;
}

/** Hasil validasi periode tulis sebelum server action memanggil database. */
export type WritablePeriodeResult =
  | { ok: true; periodeId: string | null }
  | { ok: false; message: string };

/**
 * SATU-SUMBER daftar periode.
 *
 * Semua dropdown periode di aplikasi (monitoring, bendahara,
 * sekretaris, admin, super admin, rekap, export) WAJIB memakai
 * fungsi ini. Jangan pernah membuat daftar tahun hardcoded.
 */
export const getPeriods = cache(async (): Promise<PeriodeOption[]> => {
  const supabase = await createRawClient();
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
 *  1. Admin Periode TIDAK pernah memakai cookie: satu-satunya sumber
 *     kebenaran adalah `profile.periode_id` (hasil penugasan Super Admin).
 *     Cookie, URL, body request, maupun manipulasi frontend diabaikan.
 *  2. Super Admin tetap boleh memilih periode lewat cookie, termasuk
 *     mode "Semua Periode".
 *  3. Role lain mempertahankan perilaku yang sudah ada.
 */
export const getPeriodeContext = cache(
  async (profile: Profile | null): Promise<PeriodeContext> => {
    const periods = await getPeriods();
    const superAdmin = isSuperAdmin(profile);
    const admin = profile?.role === "admin";

    // Admin hanya melihat SATU periode penugasannya. Jangan pernah
    // mengirim daftar lengkap periodes ke Client Component.
    const options = admin
      ? profile?.periode_id
        ? periods.filter((p) => p.id === profile.periode_id)
        : []
      : periods;
    const active =
      options.find((p) => p.status === "active") ?? options[0] ?? null;

    const raw = admin ? null : await getRawPeriodCookie();

    if (raw === ALL_PERIODS_VALUE && superAdmin) {
      return {
        selected: active ?? {
          id: "",
          namaPeriode: "Semua Periode",
          tahunMulai: 0,
          tahunSelesai: 0,
          status: "active",
        },
        options,
        allPeriodsMode: true,
        canSelectAllPeriods: true,
        canChangePeriod: true,
        readOnly: false,
        canWrite: true,
      };
    }

    const fromCookie = raw ? options.find((p) => p.id === raw) : null;
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
        options,
        allPeriodsMode: false,
        canSelectAllPeriods: superAdmin,
        canChangePeriod: !admin,
        readOnly: true,
        canWrite: false,
      };
    }

    return {
      selected,
      options,
      allPeriodsMode: false,
      canSelectAllPeriods: superAdmin,
      canChangePeriod: !admin,
      readOnly: selected.status !== "active",
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

/**
 * Satu-satunya gerbang periode untuk server action yang menulis data.
 *
 * Admin tidak boleh menentukan periode lewat FormData: nilai yang dikirim
 * hanya diterima bila sama dengan penugasan di `profile.periode_id`.
 * Super Admin boleh memilih periode mana pun, tetapi tetap tidak boleh
 * menulis ke periode yang bukan `active`.
 */
export async function resolveWritablePeriodeId(
  profile: Profile | null,
  requestedPeriodeId?: string | null,
  options: { allowEmptyForSuperAdmin?: boolean } = {}
): Promise<WritablePeriodeResult> {
  const superAdmin = isSuperAdmin(profile);
  if (!profile || (profile.role !== "admin" && !superAdmin)) {
    return {
      ok: false,
      message: "Hanya Admin atau Super Admin yang boleh melakukan tindakan ini.",
    };
  }

  const ctx = await getPeriodeContext(profile);
  const requested =
    requestedPeriodeId && requestedPeriodeId !== ALL_PERIODS_VALUE
      ? requestedPeriodeId
      : null;

  if (superAdmin && !requested && options.allowEmptyForSuperAdmin) {
    return { ok: true, periodeId: null };
  }

  let periodeId: string | null;
  if (superAdmin) {
    periodeId = requested ?? (ctx.allPeriodsMode ? null : ctx.selected.id || null);
  } else {
    if (requested && requested !== ctx.selected.id) {
      return {
        ok: false,
        message: `Anda hanya dapat mengelola periode ${ctx.selected.namaPeriode}.`,
      };
    }
    periodeId = ctx.selected.id || null;
  }

  if (!periodeId) {
    return {
      ok: false,
      message: ctx.allPeriodsMode
        ? "Pilih satu periode spesifik untuk menyimpan data."
        : "Periode belum ditentukan. Hubungi Super Admin.",
    };
  }

  const target = (await getPeriods()).find((p) => p.id === periodeId);
  if (!target) return { ok: false, message: "Periode tidak ditemukan." };
  if (target.status !== "active") {
    return {
      ok: false,
      message: `Periode ${target.namaPeriode} tidak writable dan hanya bisa dibaca.`,
    };
  }

  return { ok: true, periodeId: target.id };
}

/** Halaman yang butuh periode valid akan diarahkan ke dashboard. */
export async function requirePeriodContext(): Promise<PeriodeContext> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const ctx = await getPeriodeContext(profile);
  if (ctx.options.length === 0) redirect("/dashboard");
  return ctx;
}