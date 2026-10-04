import {
  ALL_PERIODS_VALUE,
  PERIOD_COOKIE,
  isPeriodScopedTable,
} from "./period-constants";

/**
 * ============================================================
 * PERIOD SCOPE (Client)
 * ============================================================
 * Semua query ke tabel yang punya `periode_id` OTOMATIS diberi
 * filter `periode_id = <periode yang dipilih>` dan otomatis
 * mengisi `periode_id` saat insert / update / upsert.
 *
 * Tujuannya: tidak ada halaman yang bisa menampilkan data periode
 * lain hanya karena lupa menulis filter. Filter dipasang di layer
 * PostgREST, sehingga benar-benar membatasi data di database,
 * bukan hanya di tampilan.
 *
 * Mode "Semua Periode" (khusus super_admin) mematikan filter untuk
 * PENBACAHAN. Operasi tulis pada mode ini tetap ditolak di tempat lain.
 */

let scopePeriodId: string | null = null;

export function getClientPeriodScope(): string | null {
  return scopePeriodId;
}

/**
 * Mengatur periode aktif untuk client.
 * `null` berarti mode "semua periode" (hanya super_admin).
 */
export function setClientPeriodScope(periodeId: string | null): void {
  scopePeriodId =
    periodeId && periodeId !== ALL_PERIODS_VALUE ? periodeId : null;
}

/** Baca cookie periode langsung dari browser (sumber sama dengan server). */
export function readPeriodCookie(): string | null {
  if (typeof document === "undefined") return null;
  const pattern = new RegExp(`(?:^|;\\s*)${PERIOD_COOKIE}=([^;]*)`);
  const match = document.cookie.match(pattern);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function writePeriodCookie(value: string): void {
  if (typeof document === "undefined") return;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  document.cookie = `${PERIOD_COOKIE}=${encodeURIComponent(
    value
  )}; Max-Age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax${secure}`;
}

/** Sinkronkan scope modul dengan cookie (dipanggil saat app dimuat). */
export function syncClientPeriodScope(): void {
  setClientPeriodScope(readPeriodCookie());
}

const WRITE_METHODS = new Set(["insert", "update", "upsert"]);

function injectPeriod(payload: unknown, periodId: string): unknown {
  if (Array.isArray(payload)) {
    return payload.map((row) =>
      row && typeof row === "object"
        ? { ...(row as Record<string, unknown>), periode_id: periodId }
        : row
    );
  }
  if (payload && typeof payload === "object") {
    return {
      ...(payload as Record<string, unknown>),
      periode_id: periodId,
    };
  }
  return payload;
}

type Builder = Record<string, unknown>;

/** Builder yang sudah mendukung filter `.eq()`. */
type FilterableBuilder = Builder & {
  eq: (column: string, value: string) => Builder;
};

function supportsEq(value: unknown): value is FilterableBuilder {
  return (
    Boolean(value) && typeof (value as FilterableBuilder).eq === "function"
  );
}

/**
 * CATATAN PENTING -- jangan dibalik.
 *
 * `supabase.from(t)` mengembalikan `PostgrestQueryBuilder` yang HANYA
 * punya select / insert / update / upsert / delete.
 *
 * `.eq()` TIDAK ADA di objek itu. `.eq()` baru ada pada
 * `PostgrestFilterBuilder` yang dikembalikan kelima method tersebut.
 *
 * Karena itu method WAJIB dipanggil lebih dulu, baru filter periode
 * dipasang ke hasilnya. Memasang `.eq()` lebih dulu akan melempar
 * `TypeError: target.eq is not a function` dan membuat seluruh
 * halaman yang touched tabel ber-periode gagal dengan HTTP 500.
 *
 * `update` dan `delete` tetap aman: keduanya juga mengembalikan
 * FilterBuilder, jadi ikut terfilter dan user tidak bisa menyentuh
 * baris milik periode lain.
 */
function wrap(
  builder: Builder,
  table: string,
  scoped: boolean,
  periodId: string
): Builder {
  return new Proxy(builder, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;

      const name = String(prop);

      return (...args: unknown[]) => {
        // Tulis: pastikan periode_id terisi dan tidak bisa dipindah user.
        // Insert dan upsert juga wajib di-inject, kalau tidak baris
        // baru akan tersimpan tanpa periode dan tidak pernah muncul.
        // Argumen pertama pada ketiganya selalu payload.
        const callArgs = WRITE_METHODS.has(name)
          ? [injectPeriod(args[0], periodId), ...args.slice(1)]
          : args;

        // Selalu panggil method di builder aslinya lebih dulu.
        const out = (value as (...a: unknown[]) => unknown).apply(
          target,
          callArgs
        );

        // Baru pasang filter periode ke hasilnya.
        if (!scoped && supportsEq(out)) {
          return wrap(out.eq("periode_id", periodId), table, true, periodId);
        }

        return wrap(out as Builder, table, scoped, periodId);
      };
    },
  });
}

/**
 * Bungkus builder PostgREST milik `table` agar terfilter periode.
 * Tabel tanpa `periode_id` (mis. `divisi`, `profiles`) dikembalikan
 * apa adanya supaya tidak mengubah perilaku lama.
 *
 * Fungsi ini murni: periode diberikan eksplisit sehingga aman dipakai
 * di server (tidak ada state global yang bocor antar request).
 */
export function scopeBuilderWithPeriod<T>(
  builder: T,
  table: string,
  periodId: string | null
): T {
  if (!isPeriodScopedTable(table)) return builder;
  if (!periodId) return builder;
  return wrap(builder as unknown as Builder, table, false, periodId) as T;
}

/** Versi client: memakai periode dari scope modul. */
export function scopeBuilder<T>(builder: T, table: string): T {
  return scopeBuilderWithPeriod(builder, table, scopePeriodId);
}