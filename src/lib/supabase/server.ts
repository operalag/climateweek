import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase env missing (server).");
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — Next.js will regenerate.
        }
      },
    },
  });
}

/** Service-role client for agent jobs. Never expose to the browser. */
export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !service) {
    throw new Error(
      "Service Supabase env missing. Set SUPABASE_SERVICE_KEY in .env.local.",
    );
  }
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Returns null instead of throwing when Supabase is unconfigured — useful
 * for render-time code that should degrade gracefully during first-run. */
export function tryGetServiceSupabase() {
  try {
    return getServiceSupabase();
  } catch {
    return null;
  }
}
