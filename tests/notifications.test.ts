// ============================================================================
// NUBCONNECT — notification contract tests
//
// Pure row/preference mapping, honest availability of stored settings, and
// mocked Supabase calls that prove read receipts and preference writes are
// scoped to the signed-in student.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { preferencesToDb } from '@/lib/auth';
import {
  isNotificationPreferenceAvailable,
  loadNotifications,
  loadUserPreferences,
  mapNotificationRow,
  markAllNotificationsRead,
  markNotificationRead,
  notificationCategory,
  notificationPreferenceColumn,
  notificationPreferencesFromDb,
  saveUserPreferences,
  type NotificationRow,
  type NotificationPreferences,
} from '@/lib/notifications';

const DEFAULTS: NotificationPreferences = {
  notifyEvents: true,
  notifyClubUpdates: true,
  notifyRoommateInquiries: true,
};

const ROW: NotificationRow = {
  id: 'n-1',
  category: 'social',
  title: 'Someone commented on your post',
  body: 'Looks good!',
  action_route: '/home',
  is_read: false,
  created_at: '2026-11-18T10:00:00.000Z',
};

/** Supabase query builder that records chained filters. */
function mockQuery(response: { data?: unknown; error?: { message: string } | null }) {
  const builder: Record<string, any> = {};
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => Promise.resolve(response));
  builder.maybeSingle = vi.fn(() => Promise.resolve(response));
  const select = vi.fn(() => builder);
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, builder };
}

/** Thenable update builder plus an upsert stub for write calls. */
function mockWrite(response: { data?: unknown; error?: { message: string } | null }) {
  const builder: Record<string, any> = {};
  builder.eq = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject);
  const update = vi.fn(() => builder);
  const upsert = vi.fn(() => Promise.resolve(response));
  const from = vi.fn(() => ({ update, upsert }));
  return { client: { from } as unknown as SupabaseClient, from, update, upsert, builder };
}

describe('pure notification mapping', () => {
  it('maps database categories, defaulting unknown ones to System', () => {
    expect(notificationCategory('social')).toBe('Social');
    expect(notificationCategory('COMMUNITIES')).toBe('Communities');
    expect(notificationCategory('something-new')).toBe('System');
  });

  it('maps a real row and does not invent a destination when none is stored', () => {
    expect(mapNotificationRow(ROW)).toMatchObject({
      id: 'n-1',
      category: 'Social',
      title: ROW.title,
      body: 'Looks good!',
      href: '/home',
      read: false,
      createdAt: ROW.created_at,
      isDemo: false,
    });
    const noRoute = mapNotificationRow({ ...ROW, action_route: null, body: null });
    expect(noRoute.href).toBe('');
    expect(noRoute.body).toBe('');
  });

  it('falls back to defaults when no preference row exists', () => {
    expect(notificationPreferencesFromDb(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(
      notificationPreferencesFromDb(
        { notify_events: false, notify_club_updates: false, notify_roommate_inquiries: null },
        DEFAULTS,
      ),
    ).toEqual({
      notifyEvents: false,
      notifyClubUpdates: false,
      notifyRoommateInquiries: true,
    });
  });
});

describe('stored preference availability', () => {
  it('allows only the three preferences that have real columns', () => {
    expect(isNotificationPreferenceAvailable('notifyEvents')).toBe(true);
    expect(isNotificationPreferenceAvailable('notifyClubUpdates')).toBe(true);
    expect(isNotificationPreferenceAvailable('notifyRoommateInquiries')).toBe(true);
    for (const invented of ['notifyMessages', 'quietHours', 'pushNotifications', 'notifyFollowers']) {
      expect(isNotificationPreferenceAvailable(invented)).toBe(false);
    }
  });

  it('names the exact column behind each supported preference', () => {
    expect(notificationPreferenceColumn('notifyEvents')).toBe('notify_events');
    expect(notificationPreferenceColumn('notifyClubUpdates')).toBe('notify_club_updates');
    expect(notificationPreferenceColumn('notifyRoommateInquiries')).toBe('notify_roommate_inquiries');
  });
});

describe('mocked persistence', () => {
  it('loads only the signed-in student’s notifications and reports errors', async () => {
    const ok = mockQuery({ data: [ROW] });
    const loaded = await loadNotifications(ok.client, 'user-1');
    expect(ok.from).toHaveBeenCalledWith('notifications');
    expect(ok.builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(loaded.notifications).toHaveLength(1);
    expect(loaded.error).toBeUndefined();

    const denied = mockQuery({ data: null, error: { message: 'RLS denied' } });
    const failed = await loadNotifications(denied.client, 'user-1');
    expect(failed.notifications).toEqual([]);
    expect(failed.error).toBe('RLS denied');
  });

  it('marks one notification read for its owner only', async () => {
    const ok = mockWrite({ error: null });
    expect(await markNotificationRead(ok.client, { id: 'n-1', userId: 'user-1' })).toEqual({ ok: true });
    expect(ok.from).toHaveBeenCalledWith('notifications');
    expect(ok.update).toHaveBeenCalledWith({ is_read: true });
    expect(ok.builder.eq).toHaveBeenCalledWith('id', 'n-1');
    expect(ok.builder.eq).toHaveBeenCalledWith('user_id', 'user-1');

    const denied = mockWrite({ error: { message: 'Not allowed' } });
    expect(await markNotificationRead(denied.client, { id: 'n-1', userId: 'user-1' })).toEqual({
      ok: false,
      error: 'Not allowed',
    });
  });

  it('marks all unread notifications read for the owner only', async () => {
    const ok = mockWrite({ error: null });
    expect(await markAllNotificationsRead(ok.client, { userId: 'user-1' })).toEqual({ ok: true });
    expect(ok.builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(ok.builder.eq).toHaveBeenCalledWith('is_read', false);
  });

  it('reads the signed-in student’s own preference row', async () => {
    const ok = mockQuery({
      data: { notify_events: false, notify_club_updates: true, notify_roommate_inquiries: false },
    });
    const result = await loadUserPreferences(ok.client, 'user-1');
    expect(ok.from).toHaveBeenCalledWith('user_preferences');
    expect(ok.builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result.row?.notify_events).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('writes preferences to the signed-in user row and surfaces RLS failures', async () => {
    const values = {
      discoverability: 'University Students Only' as const,
      allowMessages: 'Consent Requests Only' as const,
      showSemester: true,
      notifyEvents: false,
      notifyClubUpdates: true,
      notifyRoommateInquiries: false,
      showInHonours: true,
    };
    const ok = mockWrite({ error: null });
    expect(await saveUserPreferences(ok.client, { userId: 'user-1', values })).toEqual({ ok: true });
    expect(ok.from).toHaveBeenCalledWith('user_preferences');
    expect(ok.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        notify_events: false,
        notify_club_updates: true,
        notify_roommate_inquiries: false,
      }),
      { onConflict: 'user_id' },
    );

    const denied = mockWrite({ error: { message: 'row-level security violation' } });
    expect(await saveUserPreferences(denied.client, { userId: 'user-1', values })).toEqual({
      ok: false,
      error: 'row-level security violation',
    });
    expect(await saveUserPreferences(null, { userId: 'user-1', values })).toEqual({
      ok: false,
      error: 'Sign in to save preferences.',
    });
    // The payload helper must not invent columns outside the stored schema.
    expect(Object.keys(preferencesToDb(values)).sort()).toEqual(
      [
        'allow_direct_messages',
        'notify_club_updates',
        'notify_events',
        'notify_roommate_inquiries',
        'profile_visibility',
        'show_in_honours',
        'show_semester',
        'updated_at',
      ].sort(),
    );
  });
});
