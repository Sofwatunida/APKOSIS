import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { cookies } from "next/headers";
import { Database } from "../database.types";
import {
  DIVISI_TOKEN_COOKIE,
  DIVISI_TOKEN_HEADER,
} from "../division-session-constants";
import {
  ALL_PERIODS_VALUE,
  PERIOD_COOKIE,
  ACTIVE_PERIOD_SENTINEL,
} from "../period-constants";
import { scopeBuilderWithPeriod } from "../period-scope";
import { getImpersonation } from "../impersonation";

/**
 * Server-side Supabase client.
 *
 * - Mengirim `x-division-token` supaya RLS (`current_divisi_id()`)
 *   tahu divisi yang sedang dipilih oleh akun divisi bersama.
 * - Semua `.from(<tabel periode>)` otomatis difilter `periode_id`.
 *   Untuk Admin Periode, filter DIAMBIL dari `profiles.periode_id`;
 *   cookie tidak pernah dipakai. Super Admin dan role lain masih
 *   memakai cookie yang divalidasi ulang ke tabel `periods`.
 */

/** Klien tanpa period scope, dipakai untuk mencari periode aktif. */
export const createRawClient = cache(async (): Promise<SupabaseClient<Database>> => {
  const cookieStore = await cookies();

  const divisiToken = cookieStore.get(DIVISI_TOKEN_COOKIE)?.value ?? null;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: unknown }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Record<string, unknown>)
            );
          } catch {
            // Server Component called from a Server Action - can ignore
          }
        },
      },
      global: {
        fetch: (input, init) => {
          if (!divisiToken) return fetch(input, init);
          const headers = new Headers(init?.headers);
          headers.set(DIVISI_TOKEN_HEADER, divisiToken);
          return fetch(input, { ...init, headers });
        },
      },
    }
  );
});

/**
 * Mengubah hak akses pengguna + cookie menjadi id periode konkret.
 *
 * - Admin Periode -> selalu `profiles.periode_id`, cookie diabaikan.
 * - Super Admin menyamar -> periode akun tujuan penyamarannya.
 * - `semua-periode` -> null (tanpa filter, hanya super_admin; RLS
 *   tetap berlaku untuk pembacaan).
 * - uuid -> divalidasi ke tabel `periods`.
 * - kosong -> periode aktif, dibaca dari tabel `periods`.
 */
const resolvePeriodId = cache(
  async (raw: string | null): Promise<string | null> => {
    const supabase = await createRawClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, periode_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        const impersonation =
          profile.role === "super_admin" ? await getImpersonation() : null;

        if (impersonation?.periodeId) return impersonation.periodeId;

        if (!impersonation && profile.role === "admin") {
          // Cookie periode palsu / basi tidak pernah dipakai Admin.
          return profile.periode_id ?? null;
        }

        if (raw === ALL_PERIODS_VALUE && profile.role === "super_admin") {
          return null;
        }
      }
    }

    // Cookie kosong / sentinel -> periode aktif.
    if (!raw || raw === ACTIVE_PERIOD_SENTINEL) {
      const { data } = await supabase
        .from("periods")
        .select("id")
        .eq("status", "active")
        .maybeSingle();
      return data?.id ?? null;
    }

    // Cookie diisi uuid: tetap divalidasi ke tabel `periods` supaya cookie
    // basi / diketik manual tidak membuat halaman tampak kosong tanpa alasan.
    const { data } = await supabase
      .from("periods")
      .select("id")
      .eq("id", raw)
      .maybeSingle();
    if (data) return data.id;

    const { data: active } = await supabase
      .from("periods")
      .select("id")
      .eq("status", "active")
      .maybeSingle();
    return active?.id ?? null;
  }
);

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  const rawPeriod = cookieStore.get(PERIOD_COOKIE)?.value ?? null;
  const [periodeId, client] = await Promise.all([
    resolvePeriodId(rawPeriod),
    createRawClient(),
  ]);

  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== "from" || typeof value !== "function") return value;
      return (table: string) =>
        scopeBuilderWithPeriod(
          (value as (t: string) => unknown).call(target, table),
          table,
          periodeId
        );
    },
  });
}
