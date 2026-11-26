// ============================================================================
// NUBCONNECT — Notifications (real rows, real preferences)
//
// Notifications are written by the database — a new post reaches its author's
// followers, a comment or reaction reaches the post's author — so the app only
// ever reads them and marks them read.
//
// The `notifications` table has no INSERT policy for clients: the app cannot
// forge one. Reads and read-receipt updates are RLS-scoped to the signed-in
// student, and preference writes go only to their own `user_preferences` row.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppNotification } from './types';
import { preferencesToDb, type PreferencesRow } from './auth';

export interface NotificationRow {
  id: string;
  category: string;
  title: string;
  body: string | null;
  action_route: string | null;
  is_read: boolean;
  created_at: string;
}

/** The categories the notification centre groups by. */
const CATEGORIES: readonly AppNotification['category'][] = [
  'Social',
  'Messages',
  'Communities',
  'Marketplace',
  'Roommates',
  'Events',
  'Academic',
  'System',
];

/** Preferences that have a real `user_preferences` column in this schema. */
export const NOTIFICATION_PREFERENCE_COLUMNS = {
  notifyEvents: 'notify_events',
  notifyClubUpdates: 'notify_club_updates',
  notifyRoommateInquiries: 'notify_roommate_inquiries',
} as const;

export type NotificationPreferenceKey = keyof typeof NOTIFICATION_PREFERENCE_COLUMNS;

export interface NotificationPreferences {
  notifyEvents: boolean;
  notifyClubUpdates: boolean;
  notifyRoommateInquiries: boolean;
}

/** True only for a preference this deployment can actually store. */
export function isNotificationPreferenceAvailable(key: string): key is NotificationPreferenceKey {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_PREFERENCE_COLUMNS, key);
}

/** The real database column behind a supported notification preference. */
export function notificationPreferenceColumn(key: NotificationPreferenceKey): string {
  return NOTIFICATION_PREFERENCE_COLUMNS[key];
}

/** Map stored preference columns onto the UI values, falling back honestly. */
export function notificationPreferencesFromDb(
  row: PreferencesRow | null | undefined,
  defaults: NotificationPreferences,
): NotificationPreferences {
  return {
    notifyEvents: row?.notify_events ?? defaults.notifyEvents,
    notifyClubUpdates: row?.notify_club_updates ?? defaults.notifyClubUpdates,
    notifyRoommateInquiries: row?.notify_roommate_inquiries ?? defaults.notifyRoommateInquiries,
  };
}

/** Map a database category onto the centre's categories. */
export function notificationCategory(value: string): AppNotification['category'] {
  const match = CATEGORIES.find((c) => c.toLowerCase() === value.toLowerCase());
  return match ?? 'System';
}

/** Map a notification row into the card the centre renders. */
export function mapNotificationRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    category: notificationCategory(row.category),
    title: row.title,
    body: row.body ?? '',
    // No action route means no relevant destination. An empty href renders a
    // plain card instead of inventing a link the database never supplied.
    href: row.action_route ?? '',
    read: row.is_read,
    createdAt: row.created_at,
    isDemo: false,
  };
}

/** Load the signed-in student's notifications, newest first. */
export async function loadNotifications(
  client: SupabaseClient | null,
  userId?: string | null,
  limit = 60,
): Promise<{ notifications: AppNotification[]; error?: string }> {
  if (!client || !userId) return { notifications: [] };
  const { data, error } = await client
    .from('notifications')
    .select('id, category, title, body, action_route, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return { notifications: [], error: error?.message ?? 'Notifications could not be loaded.' };
  return { notifications: (data as unknown as NotificationRow[]).map(mapNotificationRow) };
}

/** Read the signed-in student's own preference row (RLS: own row only). */
export async function loadUserPreferences(
  client: SupabaseClient | null,
  userId: string,
): Promise<{ row: PreferencesRow | null; error?: string }> {
  if (!client || !userId) return { row: null };
  const { data, error } = await client
    .from('user_preferences')
    .select(
      'profile_visibility, allow_direct_messages, show_semester, notify_events, notify_club_updates, notify_roommate_inquiries, show_in_honours',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  return { row: (data as unknown as PreferencesRow | null) ?? null };
}

/**
 * Persist preferences to the signed-in student's own `user_preferences` row.
 * The payload is always keyed by that id; RLS additionally enforces ownership.
 */
export async function saveUserPreferences(
  client: SupabaseClient | null,
  input: { userId: string; values: Parameters<typeof preferencesToDb>[0] },
): Promise<{ ok: boolean; error?: string }> {
  if (!client || !input.userId) return { ok: false, error: 'Sign in to save preferences.' };
  const { error } = await client
    .from('user_preferences')
    .upsert(
      { user_id: input.userId, ...preferencesToDb(input.values) },
      { onConflict: 'user_id' },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Mark one notification read, scoped to its owner. */
export async function markNotificationRead(
  client: SupabaseClient | null,
  input: { id: string; userId: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!client || !input.userId) return { ok: false, error: 'Sign in to update notifications.' };
  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .eq('id', input.id)
    .eq('user_id', input.userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Mark every unread notification read, scoped to its owner. */
export async function markAllNotificationsRead(
  client: SupabaseClient | null,
  input: { userId: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!client || !input.userId) return { ok: false, error: 'Sign in to update notifications.' };
  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', input.userId)
    .eq('is_read', false);
  return error ? { ok: false, error: error.message } : { ok: true };
}
