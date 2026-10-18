import { cache } from "react";
import { cookies } from "next/headers";
import type { Role } from "./types";

/**
 * MODE PENYAMARAN / IMPERSONATION
 *
 * Super Admin bisa melihat dashboard suatu role persis seperti role
 * itu melihatnya, TANPA mengganti sesi Supabase yang asli.
 *
 * Cara kerja:
 *  - Role tujuan disimpan di cookie httpOnly (`apkosis_impersonation`)
 *    yang hanya bisa ditulis lewat server action (diaudit).
 *  - `getProfile()` di auth.ts menimpa `role` (dan `divisi_id`) profile
 *    HANYA bila profile asli adalah `super_admin`. Akun lain mengabaikan
 *    cookie ini sepenuhnya — jadi cookie palsu dari role lain tidak
 *    berpengaruh apa pun.
 *  - Identitas asli tidak pernah hilang: RLS, `auth.uid()`, dan audit
 *    log tetap memakai akun Super Admin yang sebenarnya.
 */

export const IMPERSONATION_COOKIE = "apkosis_impersonation";

/** Penyamaran berakhir otomatis setelah 4 jam. */
export const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60 * 4;

/** Role yang boleh ditiru. `super_admin` sengaja tidak ada di daftar. */
export const IMPERSONATABLE_ROLES: Role[] = [
  "admin",
  "monitoring",
  "bendahara",
  "sekretaris",
  "division_admin",
];

/** Data penyamaran yang aman dikirim ke client component (tanpa waktu). */
export interface ImpersonationView {
  role: Role;
  /** Wajib diisi bila role = division_admin; selain itu selalu null. */
  divisiId: string | null;
}

interface ImpersonationState extends ImpersonationView {
  startedAt: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Membaca cookie penyamaran (server only).
 *
 * Nilai cookie TIDAK pernah dipercaya mentah-mentah: role harus termasuk
 * daftar yang diizinkan, dan division_admin wajib punya divisi valid.
 * Seleksi "hanya untuk super_admin" dilakukan di `getProfile()`.
 */
export const getImpersonation = cache(
  async (): Promise<ImpersonationState | null> => {
    const store = await cookies();
    const raw = store.get(IMPERSONATION_COOKIE)?.value;
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<ImpersonationState>;
      const role = parsed.role;
      if (!role || !IMPERSONATABLE_ROLES.includes(role as Role)) return null;

      let divisiId: string | null = null;
      if (role === "division_admin") {
        // Admin Divisi butuh divisi nyata; tanpa itu, abaikan penyamaran.
        if (typeof parsed.divisiId !== "string" || !UUID_RE.test(parsed.divisiId)) {
          return null;
        }
        divisiId = parsed.divisiId;
      }

      return {
        role: role as Role,
        divisiId,
        startedAt:
          typeof parsed.startedAt === "string"
            ? parsed.startedAt
            : new Date().toISOString(),
      };
    } catch {
      // Cookie rusak/dipalsukan — perlakukan sebagai tidak ada penyamaran.
      return null;
    }
  }
);

/** ID divisi aktif selama menyamar sebagai Admin Divisi. */
export const getImpersonationDivisiId = cache(
  async (): Promise<string | null> => {
    const imp = await getImpersonation();
    return imp?.role === "division_admin" ? imp.divisiId : null;
  }
);

/** Hanya dipanggil dari server action milik Super Admin. */
export async function setImpersonationCookie(
  state: ImpersonationView
): Promise<void> {
  const store = await cookies();
  const payload: ImpersonationState = {
    role: state.role,
    divisiId: state.role === "division_admin" ? state.divisiId : null,
    startedAt: new Date().toISOString(),
  };
  store.set(IMPERSONATION_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_MAX_AGE_SECONDS,
  });
}

/** Hanya dipanggil dari server action milik Super Admin. */
export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
