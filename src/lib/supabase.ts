// ============================================================================
// NUBCONNECT — Supabase integration.
// Real @supabase/ssr clients. When NEXT_PUBLIC_SUPABASE_URL and the anon key
// are configured the app reads/writes the real backend through src/lib/data.
// Without credentials every surface falls back to the clearly-labelled DEMO
// dataset — never silently pretending demo content is live data.
// ============================================================================
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const DEFAULT_UNIVERSITY_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_UNIVERSITY_SLUG ?? 'nub';

/** True only when a real Supabase project is wired via environment variables. */
export function isBackendConfigured(): boolean {
  return (
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_URL.includes('your-project-id')
  );
}

let browserClient: SupabaseClient | null = null;

/** Lazily-created browser client (anon key — protected by Row Level Security). */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isBackendConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
