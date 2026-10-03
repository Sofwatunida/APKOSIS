import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../database.types";
import {
  DIVISI_TOKEN_COOKIE,
  DIVISI_TOKEN_HEADER,
} from "../division-session-constants";
import {
  scopeBuilder,
  setClientPeriodScope,
  readPeriodCookie,
} from "../period-scope";

let rawClient: SupabaseClient<Database> | null = null;
let scopedClient: SupabaseClient<Database> | null = null;
let lastScope: string | null | undefined = undefined;

function readDivisionToken(): string | null {
  if (typeof document === "undefined") return null;
  const pattern = new RegExp(
    `(?:^|;\\s*)${DIVISI_TOKEN_COOKIE}=([^;]*)`
  );
  const match = document.cookie.match(pattern);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function getRawClient(): SupabaseClient<Database> {
  if (rawClient) return rawClient;
  rawClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => {
          const token = readDivisionToken();
          if (!token) return fetch(input, init);
          const headers = new Headers(init?.headers);
          headers.set(DIVISI_TOKEN_HEADER, token);
          return fetch(input, { ...init, headers });
        },
      },
    }
  );
  return rawClient;
}

/**
 * Client Supabase untuk browser.
 *
 * Semua `.from(<tabel periode>)` otomatis dibungkus proxy yang
 * memasang filter `periode_id` dan mengisi `periode_id` saat menulis.
 * Lihat `src/lib/period-scope.ts`.
 */
export function createClient(): SupabaseClient<Database> {
  const cookieValue = readPeriodCookie();
  const scope = cookieValue ?? null;

  if (scopedClient && lastScope === scope) return scopedClient;

  setClientPeriodScope(scope);
  lastScope = scope;

  const client = getRawClient();

  scopedClient = new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== "from" || typeof value !== "function") return value;
      return (table: string) =>
        scopeBuilder((value as (t: string) => unknown).call(target, table), table);
    },
  });

  return scopedClient;
}