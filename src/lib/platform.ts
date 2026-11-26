// ============================================================================
// NUBCONNECT — platform switches every surface reads
// ----------------------------------------------------------------------------
// The switches live in `system_settings` and are only readable through the
// `platform_flags()` RPC. This module never trusts a frontend-only flag: the
// admin RPCs remain the write path and the database stays the source of truth.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlatformAnnouncement {
  message: string;
}

export interface PlatformFlags {
  campus_pulse: boolean;
  marketplace: boolean;
  roommates: boolean;
  stories: boolean;
  announcement: PlatformAnnouncement | null;
}

/**
 * The student app assumes features are on until the backend says otherwise —
 * except Stories, which must stay off until the surface actually ships.
 */
export const DEFAULT_PLATFORM_FLAGS: PlatformFlags = {
  campus_pulse: true,
  marketplace: true,
  roommates: true,
  stories: false,
  announcement: null,
};

/** Coerce a partially-shaped RPC payload into a complete flag set. */
export function mapPlatformFlags(raw: unknown): PlatformFlags {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PLATFORM_FLAGS };
  const value = raw as Record<string, unknown>;
  const announcement =
    value.announcement && typeof value.announcement === 'object'
      ? (value.announcement as Record<string, unknown>)
      : null;

  return {
    campus_pulse:
      typeof value.campus_pulse === 'boolean'
        ? value.campus_pulse
        : DEFAULT_PLATFORM_FLAGS.campus_pulse,
    marketplace:
      typeof value.marketplace === 'boolean'
        ? value.marketplace
        : DEFAULT_PLATFORM_FLAGS.marketplace,
    roommates:
      typeof value.roommates === 'boolean'
        ? value.roommates
        : DEFAULT_PLATFORM_FLAGS.roommates,
    stories:
      typeof value.stories === 'boolean' ? value.stories : DEFAULT_PLATFORM_FLAGS.stories,
    announcement:
      announcement && typeof announcement.message === 'string' && announcement.message.trim()
        ? { message: announcement.message.trim() }
        : null,
  };
}

export async function loadPlatformFlags(supabase: SupabaseClient): Promise<PlatformFlags> {
  const { data, error } = await supabase.rpc('platform_flags');
  if (error || !data) return { ...DEFAULT_PLATFORM_FLAGS };
  return mapPlatformFlags(data);
}
