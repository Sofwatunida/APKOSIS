import { createBrowserClient } from "@supabase/ssr";
import { Database } from "../database.types";
import {
  DIVISI_TOKEN_COOKIE,
  DIVISI_TOKEN_HEADER,
} from "../division-session-constants";

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

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

export function createClient() {
  if (clientInstance) return clientInstance;
  clientInstance = createBrowserClient<Database>(
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
  return clientInstance;
}
