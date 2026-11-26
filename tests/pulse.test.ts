// ============================================================================
// NUBCONNECT — Campus Pulse unit tests
//
// Campus Pulse is the one place where a student's presence becomes visible, so
// the mapping rules matter more than most. These tests hold three promises:
//   • a status is only ever the one the student chose (never invented);
//   • "on campus" comes from the row, not from being signed in;
//   • activity counts and join states reflect the database exactly;
//   • safety actions only claim success when a real row was written.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AVAILABILITY_STATUSES,
  AVAILABILITY_BY_KEY,
  FALLBACK_AVAILABILITY_STATUS,
  PULSE_ACTIVITY_CATEGORIES,
  PULSE_INTENTS,
  ACTIVITY_REPORT_REASONS,
  buildActivityReportRow,
  cancelActivity,
  isActivityReportReason,
  loadActivityConversations,
  mapActivityRow,
  mapAvailabilityRow,
  planIdFromConversationContext,
  remainingMinutes,
  reportActivity,
  updateActivityCover,
  type ActivityRow,
  type AvailabilityRow,
} from '@/lib/pulse';

const NOW = new Date('2026-05-01T10:00:00.000Z');

const AVAILABILITY: AvailabilityRow = {
  id: 'status-1',
  user_id: 'user-1',
  activity: 'Free to chat',
  spot_note: 'Central Library',
  note: 'Between classes until 2pm',
  posted_at: '2026-05-01T09:45:00.000Z',
  expires_at: '2026-05-01T11:45:00.000Z',
  open_to_connect: true,
  status_key: 'free_to_chat',
  on_campus: true,
  visibility: 'university',
  campus_area_id: null,
  profiles: {
    id: 'user-1',
    username: 'rakib.cse',
    display_name: 'Rakib Islam',
    avatar_url: 'https://cdn.test/rakib.jpg',
    is_verified_student: true,
    semester_label: '7th Semester',
    interests: ['Photography'],
    departments: { code: 'CSE' },
  },
};

const ACTIVITY: ActivityRow = {
  id: 'plan-1',
  title: 'Coffee before class',
  description: 'Short one, everyone welcome.',
  category: 'coffee_break',
  cover_image_url: null,
  meeting_spot: 'Campus cafeteria',
  starts_at: '2026-05-01T10:30:00.000Z',
  duration_minutes: 30,
  participant_limit: 3,
  join_mode: 'request',
  status: 'open',
  created_by: 'host-1',
  note: null,
  host: { id: 'host-1', username: 'nadia.bba', display_name: 'Nadia Akter', avatar_url: null },
  activity_plan_participants: [
    {
      user_id: 'host-1',
      profiles: { id: 'host-1', username: 'nadia.bba', display_name: 'Nadia Akter', avatar_url: null },
    },
    {
      user_id: 'user-2',
      profiles: { id: 'user-2', username: 'sabbir.eee', display_name: 'Sabbir Hossain', avatar_url: null },
    },
  ],
  activity_plan_requests: [
    {
      id: 'req-1',
      user_id: 'user-2',
      status: 'accepted',
      note: 'Count me in',
      profiles: { id: 'user-2', username: 'sabbir.eee', display_name: 'Sabbir Hossain', avatar_url: null },
    },
    {
      id: 'req-2',
      user_id: 'user-3',
      status: 'pending',
      note: 'Can I bring a friend?',
      profiles: { id: 'user-3', username: 'tania.eng', display_name: 'Tania Rahman', avatar_url: null },
    },
    {
      id: 'req-3',
      user_id: 'user-4',
      status: 'declined',
      note: null,
      profiles: { id: 'user-4', username: 'arshad.cse', display_name: 'Arshad Karim', avatar_url: null },
    },
  ],
};

/** A minimal awaitable query builder for mocked persistence calls. */
interface FakeBuilder {
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
}

function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  const builder = {} as FakeBuilder;
  builder.update = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve) => Promise.resolve(result).then(resolve);

  const from = vi.fn(() => builder);
  const client = { from } as unknown as SupabaseClient;
  return { client, builder, from };
}

describe('availability vocabulary', () => {
  it('has unique status keys', () => {
    const keys = AVAILABILITY_STATUSES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only filters by intentions the vocabulary can express', () => {
    const expressible = new Set(AVAILABILITY_STATUSES.map((s) => s.intent));
    for (const intent of PULSE_INTENTS) {
      if (intent.key === 'all' || intent.key === 'on_campus') continue;
      expect(expressible.has(intent.key)).toBe(true);
    }
  });

  it('keeps a neutral fallback that does not imply a check-in', () => {
    expect(FALLBACK_AVAILABILITY_STATUS.impliesOnCampus).toBeFalsy();
    expect(AVAILABILITY_BY_KEY[FALLBACK_AVAILABILITY_STATUS.key]).toBeUndefined();
  });

  it('has unique activity categories', () => {
    const keys = PULSE_ACTIVITY_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('mapAvailabilityRow', () => {
  it('maps exactly what the student published', () => {
    const entry = mapAvailabilityRow(AVAILABILITY, 'user-1');

    expect(entry.userId).toBe('user-1');
    expect(entry.name).toBe('Rakib Islam');
    expect(entry.username).toBe('rakib.cse');
    expect(entry.avatarUrl).toBe('https://cdn.test/rakib.jpg');
    expect(entry.departmentCode).toBe('CSE');
    expect(entry.semester).toBe('7th Semester');
    expect(entry.interests).toEqual(['Photography']);
    expect(entry.status.key).toBe('free_to_chat');
    expect(entry.message).toBe('Between classes until 2pm');
    expect(entry.spot).toBe('Central Library');
    expect(entry.onCampus).toBe(true);
    expect(entry.openToConnect).toBe(true);
    expect(entry.visibility).toBe('university');
    expect(entry.isMine).toBe(true);
  });

  it('does not mark someone else as mine', () => {
    expect(mapAvailabilityRow(AVAILABILITY, 'someone-else').isMine).toBe(false);
  });

  it('never turns a missing status into an on-campus claim', () => {
    const entry = mapAvailabilityRow({
      ...AVAILABILITY,
      status_key: null,
      activity: 'Studying',
      on_campus: false,
    });

    expect(entry.status).toEqual(FALLBACK_AVAILABILITY_STATUS);
    expect(entry.onCampus).toBe(false);
  });

  it('falls back to the university audience for unknown visibility values', () => {
    const entry = mapAvailabilityRow({ ...AVAILABILITY, visibility: 'everyone-forever' });
    expect(entry.visibility).toBe('university');
  });

  it('survives a missing profile join without inventing a name', () => {
    const entry = mapAvailabilityRow({ ...AVAILABILITY, profiles: null });
    expect(entry.name).toBe('Student');
    expect(entry.username).toBe('');
    expect(entry.departmentCode).toBe('NUB');
    expect(entry.interests).toEqual([]);
  });
});

describe('mapActivityRow', () => {
  it('counts real participants and resolves the category', () => {
    const activity = mapActivityRow(ACTIVITY, 'host-1');

    expect(activity.participantCount).toBe(2);
    expect(activity.participantLimit).toBe(3);
    expect(activity.categoryLabel).toBe('Coffee break');
    expect(activity.categoryEmoji).toBe('☕');
    expect(activity.hostName).toBe('Nadia Akter');
    expect(activity.joinMode).toBe('request');
    expect(activity.isMine).toBe(true);
    expect(activity.isFull).toBe(false);
    expect(activity.coverUrl).toBeNull();
  });

  it('maps a stored cover URL without substituting a placeholder', () => {
    const withCover = mapActivityRow(
      { ...ACTIVITY, cover_image_url: 'https://cdn.test/activity-cover.jpg' },
      'host-1',
    );
    expect(withCover.coverUrl).toBe('https://cdn.test/activity-cover.jpg');
  });

  it('exposes only pending requests, and only they matter to the host', () => {
    const activity = mapActivityRow(ACTIVITY, 'host-1');

    expect(activity.pendingRequests).toHaveLength(1);
    expect(activity.pendingRequests[0]?.userId).toBe('user-3');
    expect(activity.pendingRequests[0]?.note).toBe('Can I bring a friend?');
  });

  it('reports the viewer’s own join state', () => {
    const joined = mapActivityRow(ACTIVITY, 'user-2');
    expect(joined.isJoined).toBe(true);
    expect(joined.isMine).toBe(false);
    expect(joined.requestStatus).toBe('accepted');

    const stranger = mapActivityRow(ACTIVITY, 'user-9');
    expect(stranger.isJoined).toBe(false);
    expect(stranger.requestStatus).toBeUndefined();
  });

  it('marks an activity full only when the limit is reached', () => {
    const full = mapActivityRow({ ...ACTIVITY, participant_limit: 2 }, 'user-9');
    expect(full.isFull).toBe(true);

    const unlimited = mapActivityRow({ ...ACTIVITY, participant_limit: 0 }, 'user-9');
    expect(unlimited.isFull).toBe(false);
  });
});

describe('remainingMinutes', () => {
  it('rounds down to a friendly whole number', () => {
    expect(remainingMinutes('2026-05-01T11:45:00.000Z', NOW.getTime())).toBe(105);
  });

  it('never reports negative time left', () => {
    expect(remainingMinutes('2026-04-30T11:45:00.000Z', NOW.getTime())).toBe(0);
  });
});

describe('activity reporting', () => {
  it('only accepts the reasons the reports table understands', () => {
    expect(ACTIVITY_REPORT_REASONS.length).toBeGreaterThan(0);
    expect(isActivityReportReason('spam')).toBe(true);
    expect(isActivityReportReason('made-up-reason')).toBe(false);
  });

  it('builds a report row that targets the real activity', () => {
    expect(
      buildActivityReportRow({
        reporterId: 'user-9',
        universityId: 'uni-1',
        planId: 'plan-1',
        reasonCategory: 'spam',
        details: '  Repeated spam  ',
      }),
    ).toEqual({
      university_id: 'uni-1',
      reporter_id: 'user-9',
      target_type: 'activity_plan',
      target_id: 'plan-1',
      reason_category: 'spam',
      details: 'Repeated spam',
    });
  });

  it('refuses an invalid report instead of fabricating one', () => {
    expect(
      buildActivityReportRow({
        reporterId: 'user-9',
        universityId: 'uni-1',
        planId: '',
        reasonCategory: 'spam',
      }),
    ).toBeNull();
    expect(
      buildActivityReportRow({
        reporterId: 'user-9',
        universityId: 'uni-1',
        planId: 'plan-1',
        reasonCategory: 'anything-goes',
      }),
    ).toBeNull();
  });

  it('claims success only when the report row was written', async () => {
    const saved = fakeClient({ data: { id: 'report-1' }, error: null });
    expect(
      await reportActivity(saved.client, {
        reporterId: 'user-9',
        universityId: 'uni-1',
        planId: 'plan-1',
        reasonCategory: 'harassment',
      }),
    ).toEqual({ ok: true });
    expect(saved.builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ target_id: 'plan-1', reason_category: 'harassment' }),
    );

    const rejected = fakeClient({ data: null, error: { message: 'permission denied' } });
    expect(
      await reportActivity(rejected.client, {
        reporterId: 'user-9',
        universityId: 'uni-1',
        planId: 'plan-1',
        reasonCategory: 'spam',
      }),
    ).toEqual({ ok: false, error: 'permission denied' });
  });
});

describe('activity lifecycle and covers', () => {
  it('cancels only an open activity hosted by the caller', async () => {
    const { client, builder, from } = fakeClient({ data: { id: 'plan-1' }, error: null });
    expect(await cancelActivity(client, { planId: 'plan-1', creatorId: 'host-1' })).toEqual({
      ok: true,
    });
    expect(from).toHaveBeenCalledWith('activity_plans');
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    expect(builder.eq).toHaveBeenCalledWith('created_by', 'host-1');
    expect(builder.eq).toHaveBeenCalledWith('status', 'open');
  });

  it('does not claim a cancellation when no row was updated', async () => {
    const { client } = fakeClient({ data: null, error: null });
    const result = await cancelActivity(client, { planId: 'plan-1', creatorId: 'host-1' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/only the organiser/i);
  });

  it('persists an uploaded cover only on the organiser’s own activity', async () => {
    const { client, builder } = fakeClient({ data: { id: 'plan-1' }, error: null });
    const result = await updateActivityCover(client, {
      planId: 'plan-1',
      creatorId: 'host-1',
      coverUrl: 'https://cdn.test/real-cover.jpg',
    });
    expect(result).toEqual({ ok: true });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ cover_image_url: 'https://cdn.test/real-cover.jpg' }),
    );
    expect(builder.eq).toHaveBeenCalledWith('created_by', 'host-1');
  });

  it('never stores a cover when the write fails', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'not the host' } });
    expect(
      await updateActivityCover(client, {
        planId: 'plan-1',
        creatorId: 'someone-else',
        coverUrl: 'https://cdn.test/real-cover.jpg',
      }),
    ).toEqual({ ok: false, error: 'not the host' });
  });
});

describe('activity-linked conversations', () => {
  it('reads a plan id only from a real conversation context', () => {
    expect(planIdFromConversationContext({ plan_id: 'plan-1' })).toBe('plan-1');
    expect(planIdFromConversationContext({ activity_plan_id: 'plan-2' })).toBe('plan-2');
    expect(planIdFromConversationContext({ plan_id: 42 })).toBeNull();
    expect(planIdFromConversationContext(null)).toBeNull();
  });

  it('returns no links without a lookup when there are no activities', async () => {
    const { client, from } = fakeClient({ data: [], error: null });
    expect(await loadActivityConversations(client, [])).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it('links a plan only to a stored conversation that names it', async () => {
    const { client } = fakeClient({
      data: [{ id: 'conv-1', context: { plan_id: 'plan-1' } }],
      error: null,
    });
    expect(await loadActivityConversations(client, ['plan-1'])).toEqual({ 'plan-1': 'conv-1' });
  });
});
