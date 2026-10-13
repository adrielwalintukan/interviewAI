import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicSupabaseConfig } from "./config";

/** Per-request client acting as the signed-in user (RLS applies). */
export async function createClient() {
  // supabase-js checks token expiry with Date.now(), which Cache Components forbids during
  // (runtime) prerender; connection() defers everything session-based to request time.
  await connection();
  const cookieStore = await cookies();
  const { url, anonKey } = publicSupabaseConfig();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't write cookies; proxy.ts refreshes the session on every navigation.
        }
      },
    },
  });
}
