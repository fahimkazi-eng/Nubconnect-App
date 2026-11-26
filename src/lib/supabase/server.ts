// ============================================================================
// NUBCONNECT — Server-side Supabase client (App Router).
// Uses the request's cookies so the session is shared with the browser and
// refreshed by middleware. Returns null when no backend is configured.
// ============================================================================
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isBackendConfigured } from '../supabase';

export async function createSupabaseServerClient() {
  if (!isBackendConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render: cookies are read-only there.
          // Middleware performs the actual refresh; safe to ignore.
        }
      },
    },
  });
}
