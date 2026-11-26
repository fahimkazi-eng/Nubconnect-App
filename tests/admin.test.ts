// ============================================================================
// NUBCONNECT — Admin command centre helper tests
//
// The admin UI is not a security boundary, but it must still be honest: it may
// only offer actions the role actually holds, and it must never turn a metric
// it could not measure into a confident zero. These tests pin those rules.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ADMIN_PERMISSION_LABELS,
  ADMIN_ROLE_LABELS,
  EMPTY_ADMIN_ACCESS,
  archiveLaunchPost,
  can,
  formatBytes,
  formatCount,
  hasAnyAdminRole,
  loadAdminPages,
  loadAdminReports,
  loadLaunchContent,
  moderatePost,
  resolveAdminReport,
  restoreLaunchPost,
  roleLabel,
  type AdminAccess,
  type AdminPageRow,
  type LaunchContentRow,
} from '../src/lib/admin';
import {
  EDITORIAL_GROUPING_NOTE,
  EDITORIAL_REVIEW_NOTE,
  EDITORIAL_VERIFICATION_NOTE,
  MODERATION_SCOPE_NOTE,
  PAGES_READ_ONLY_NOTE,
  SCHEDULING_UNAVAILABLE,
  editorialActionFor,
  editorialDateKey,
  editorialMonthLabel,
  editorialPublicationLabel,
  editorialReviewDate,
  editorialRightsLabel,
  editorialSourceLabel,
  editorialVerificationLabel,
  groupEditorialByMonth,
  moderationAvailability,
} from '../src/lib/editorial';
import { DEFAULT_PLATFORM_FLAGS, mapPlatformFlags } from '../src/lib/platform';

function access(overrides: Partial<AdminAccess> = {}): AdminAccess {
  return {
    ...EMPTY_ADMIN_ACCESS,
    permissions: { ...EMPTY_ADMIN_ACCESS.permissions },
    ...overrides,
  };
}

describe('admin roles and permissions', () => {
  it('labels every operational role', () => {
    expect(ADMIN_ROLE_LABELS.super_admin).toBe('Super Admin');
    expect(ADMIN_ROLE_LABELS.department_admin).toBe('Department Admin');
    expect(Object.keys(ADMIN_ROLE_LABELS)).toHaveLength(6);
  });

  it('falls back to a readable label for unknown roles', () => {
    expect(roleLabel('university_content_admin')).toBe('university content admin');
    expect(roleLabel(null)).toBe('No role');
  });

  it('describes every permission key', () => {
    for (const label of Object.values(ADMIN_PERMISSION_LABELS)) {
      expect(label.length).toBeGreaterThan(3);
    }
  });

  it('treats a signed-out visitor as a non-admin', () => {
    expect(can(null, 'users.view')).toBe(false);
    expect(hasAnyAdminRole(null)).toBe(false);
  });

  it('never grants a permission just because the visitor is an admin', () => {
    const moderator = access({ is_admin: true, roles: ['moderator'], permissions: { ...EMPTY_ADMIN_ACCESS.permissions, 'content.moderate': true } });
    expect(can(moderator, 'content.moderate')).toBe(true);
    expect(can(moderator, 'features.manage')).toBe(false);
    expect(can(moderator, 'roles.manage')).toBe(false);
  });

  it('ignores permissions on a non-admin payload', () => {
    const spoofed = access({ is_admin: false, permissions: { ...EMPTY_ADMIN_ACCESS.permissions, 'roles.manage': true } });
    expect(can(spoofed, 'roles.manage')).toBe(false);
    expect(hasAnyAdminRole(spoofed)).toBe(false);
  });

  it('recognizes a super admin', () => {
    const superAdmin = access({
      is_admin: true,
      is_super_admin: true,
      roles: ['super_admin'],
      permissions: Object.fromEntries(
        Object.keys(ADMIN_PERMISSION_LABELS).map((key) => [key, true]),
      ) as AdminAccess['permissions'],
    });
    expect(hasAnyAdminRole(superAdmin)).toBe(true);
    for (const key of Object.keys(ADMIN_PERMISSION_LABELS)) {
      expect(can(superAdmin, key as keyof typeof ADMIN_PERMISSION_LABELS)).toBe(true);
    }
  });
});

describe('honest metric formatting', () => {
  it('shows "Not measured" instead of inventing zero', () => {
    expect(formatCount(null)).toBe('Not measured');
    expect(formatCount(undefined)).toBe('Not measured');
    expect(formatCount(0)).toBe('0');
  });

  it('groups large counts', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it('formats byte sizes and keeps an unmeasured value honest', () => {
    expect(formatBytes(null)).toBe('Not measured');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(9_961_472)).toBe('9.5 MB');
  });
});

describe('platform flags', () => {
  it('defaults to the features that have actually shipped', () => {
    expect(DEFAULT_PLATFORM_FLAGS.campus_pulse).toBe(true);
    expect(DEFAULT_PLATFORM_FLAGS.marketplace).toBe(true);
    expect(DEFAULT_PLATFORM_FLAGS.roommates).toBe(true);
    expect(DEFAULT_PLATFORM_FLAGS.stories).toBe(false);
    expect(DEFAULT_PLATFORM_FLAGS.announcement).toBeNull();
  });

  it('falls back to defaults for a malformed payload', () => {
    expect(mapPlatformFlags(null)).toEqual(DEFAULT_PLATFORM_FLAGS);
    expect(mapPlatformFlags('nope')).toEqual(DEFAULT_PLATFORM_FLAGS);
  });

  it('honours a real switch coming from the database', () => {
    const flags = mapPlatformFlags({
      campus_pulse: false,
      marketplace: true,
      roommates: false,
      stories: true,
      announcement: { message: '  Mid-term schedules are published.  ' },
    });
    expect(flags.campus_pulse).toBe(false);
    expect(flags.roommates).toBe(false);
    expect(flags.stories).toBe(true);
    expect(flags.announcement?.message).toBe('Mid-term schedules are published.');
  });

  it('treats a blank announcement as no announcement', () => {
    expect(mapPlatformFlags({ announcement: { message: '   ' } }).announcement).toBeNull();
    expect(mapPlatformFlags({ announcement: {} }).announcement).toBeNull();
  });

  it('keeps a missing key at its documented default', () => {
    const flags = mapPlatformFlags({ marketplace: false });
    expect(flags.marketplace).toBe(false);
    expect(flags.campus_pulse).toBe(true);
    expect(flags.stories).toBe(false);
  });
});

// --- Editorial review -------------------------------------------------------
// Fixtures below are test data only. The app renders only RPC rows.

function launchRow(overrides: Partial<LaunchContentRow> = {}): LaunchContentRow {
  return {
    id: 'post-1',
    title: 'Library hours',
    body_preview: 'Reading room hours for the term.',
    page_name: 'NUB Connect',
    seed_batch: 'launch-2026-01',
    source_organization: 'NUB Library',
    source_url: null,
    content_rights: 'University press release',
    internal_reviewer: 'A. Staff',
    publication_status: 'published',
    is_hidden: false,
    removal_eligible: true,
    original_published_at: '2026-01-15T09:00:00.000Z',
    created_at: '2026-01-16T09:00:00.000Z',
    ...overrides,
  };
}

describe('editorial review mapping', () => {
  it('groups by recorded original date and puts undated rows last', () => {
    const rows = [
      launchRow({ id: 'a', original_published_at: '2026-01-15T09:00:00.000Z' }),
      launchRow({ id: 'b', original_published_at: '2026-02-03T09:00:00.000Z' }),
      launchRow({ id: 'c', original_published_at: null, created_at: '' }),
    ];
    const groups = groupEditorialByMonth(rows);
    expect(groups.map((group) => group.key)).toEqual(['2026-02', '2026-01', 'undated']);
    expect(groups[0].label).toBe('February 2026');
    expect(groups[2].label).toBe('Date not recorded');
    expect(groups[1].rows.map((row) => row.id)).toEqual(['a']);
  });

  it('falls back to the import date only when no original date exists', () => {
    const row = launchRow({ original_published_at: null });
    expect(editorialReviewDate(row)).toBe('2026-01-16T09:00:00.000Z');
    expect(editorialDateKey(editorialReviewDate(row))).toBe('2026-01');
  });

  it('uses UTC so a timestamp cannot drift into another month', () => {
    expect(editorialDateKey('2026-03-01T00:30:00+02:00')).toBe('2026-02');
    expect(editorialDateKey('')).toBe('undated');
    expect(editorialDateKey('not-a-date')).toBe('undated');
    expect(editorialMonthLabel('undated')).toBe('Date not recorded');
  });

  it('never invents source, rights or reviewer information', () => {
    expect(editorialSourceLabel(launchRow({ source_organization: '  ' }))).toBe('Source not recorded');
    expect(editorialRightsLabel(launchRow({ content_rights: null }))).toBe('Rights not recorded');
    expect(editorialVerificationLabel(launchRow({ internal_reviewer: null }))).toBe('No reviewer recorded');
    expect(editorialVerificationLabel(launchRow({ internal_reviewer: 'A. Staff' }))).toBe('Reviewed by A. Staff');
    expect(
      editorialVerificationLabel(launchRow({ internal_reviewer: null, publication_status: 'archived' })),
    ).toBe('No reviewer recorded');
  });

  it('shows the publication status and the hidden flag separately', () => {
    expect(editorialPublicationLabel(launchRow())).toBe('published');
    expect(editorialPublicationLabel(launchRow({ is_hidden: true }))).toBe('published · hidden from students');
    expect(editorialPublicationLabel(launchRow({ publication_status: 'archived' }))).toBe('archived');
  });

  it('describes month groups as a review view, not scheduling', () => {
    expect(SCHEDULING_UNAVAILABLE).toContain('Requires backend support');
    expect(SCHEDULING_UNAVAILABLE).toContain('No admin RPC sets a publish date');
    expect(EDITORIAL_GROUPING_NOTE).toContain('review buckets, not scheduled publish slots');
    expect(EDITORIAL_REVIEW_NOTE).toContain('admin_list_launch_content');
    expect(EDITORIAL_VERIFICATION_NOTE).toContain('does not return a Page verification flag');
    expect(PAGES_READ_ONLY_NOTE).toContain('active Pages only');
    expect(MODERATION_SCOPE_NOTE).toContain('Pages they manage');
  });
});

describe('editorial moderation affordances', () => {
  it('only allows archive where the RPC would accept it', () => {
    const moderator = { canModerate: true, isSuperAdmin: false };
    expect(moderationAvailability(launchRow(), moderator).archive).toEqual({ allowed: true, reason: null });
    const protectedRow = launchRow({ removal_eligible: false });
    expect(moderationAvailability(protectedRow, moderator).archive.reason).toContain('Protected from removal');
    expect(
      moderationAvailability(protectedRow, { canModerate: true, isSuperAdmin: true }).archive.allowed,
    ).toBe(true);
    expect(moderationAvailability(launchRow({ publication_status: 'archived' }), moderator).archive.reason).toBe(
      'Already archived.',
    );
  });

  it('explains why restore is unavailable for a visible post', () => {
    const options = { canModerate: true, isSuperAdmin: false };
    expect(moderationAvailability(launchRow(), options).restore.reason).toBe('Already visible to students.');
    expect(
      moderationAvailability(launchRow({ is_hidden: true, publication_status: 'archived' }), options).restore.allowed,
    ).toBe(true);
  });

  it('never offers moderation without the database permission', () => {
    const availability = moderationAvailability(launchRow(), { canModerate: false, isSuperAdmin: false });
    expect(availability.archive.allowed).toBe(false);
    expect(availability.restore.allowed).toBe(false);
    expect(availability.archive.reason).toBe('Your role cannot moderate content.');
    expect(availability.restore.reason).toBe('Your role cannot moderate content.');
  });

  it('suggests the action that matches the current state', () => {
    expect(editorialActionFor(launchRow())).toBe('archive');
    expect(editorialActionFor(launchRow({ is_hidden: true }))).toBe('restore');
    expect(editorialActionFor(launchRow({ publication_status: 'archived' }))).toBe('restore');
  });
});

// --- RPC wrappers with a mocked Supabase client -----------------------------

function mockRpc(rows: unknown = null, message: string | null = null) {
  const calls: Array<{ name: string; params: Record<string, unknown> | undefined }> = [];
  const rpc = vi.fn(async (name: string, params?: Record<string, unknown>) => {
    calls.push({ name, params });
    return { data: rows, error: message ? { message } : null };
  });
  return { client: { rpc } as unknown as SupabaseClient, calls, rpc };
}

function mockPages(response: { data: AdminPageRow[] | null; error: { message: string } | null }) {
  const calls: string[] = [];
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockImplementation((column: string, value: unknown) => {
    calls.push(`eq:${column}:${String(value)}`);
    return builder;
  });
  builder.order.mockReturnValue(builder);
  builder.limit.mockResolvedValue(response);
  const from = vi.fn((table: string) => {
    calls.push(`from:${table}`);
    return builder;
  });
  return { client: { from } as unknown as SupabaseClient, calls, builder, from };
}

describe('editorial RPC wrappers', () => {
  it('calls admin_list_launch_content with the exact documented parameters', async () => {
    const rows = [launchRow()];
    const { client, calls } = mockRpc(rows);
    const result = await loadLaunchContent(client, 'launch-2026-01', 75);
    expect(calls).toEqual([
      {
        name: 'admin_list_launch_content',
        params: { p_batch: 'launch-2026-01', p_limit: 75, p_offset: 0 },
      },
    ]);
    expect(result.data).toEqual(rows);
    expect(result.error).toBeNull();
  });

  it('surfaces a database error instead of pretending a read succeeded', async () => {
    const { client } = mockRpc(null, 'Permission denied');
    expect((await loadLaunchContent(client, null)).error).toBe('Permission denied');
  });

  it('archives and restores only through the audited moderation RPC', async () => {
    const archive = mockRpc(null);
    expect(await archiveLaunchPost(archive.client, 'post-1', 'retiring old copy')).toBeNull();
    expect(archive.calls).toEqual([
      {
        name: 'admin_moderate_post',
        params: { p_post_id: 'post-1', p_action: 'archive', p_reason: 'retiring old copy' },
      },
    ]);

    const restore = mockRpc(null, 'Protected from removal');
    expect(await restoreLaunchPost(restore.client, 'post-1', 'restoring reviewed copy')).toBe(
      'Protected from removal',
    );
    expect(restore.calls).toEqual([
      {
        name: 'admin_moderate_post',
        params: { p_post_id: 'post-1', p_action: 'restore', p_reason: 'restoring reviewed copy' },
      },
    ]);
  });

  it('forwards hide to the RPC but does not expose it in the editorial affordances', async () => {
    const { client, calls } = mockRpc(null);
    await moderatePost(client, 'post-1', 'hide', 'temporary hide');
    expect(calls[0].params?.p_action).toBe('hide');
    expect(moderationAvailability(launchRow(), { canModerate: true, isSuperAdmin: true })).not.toHaveProperty('hide');
  });

  it('uses the existing report RPCs without new schema', async () => {
    const list = mockRpc([]);
    const listed = await loadAdminReports(list.client, 'open', 10);
    expect(list.calls).toEqual([
      { name: 'admin_list_reports', params: { p_status: 'open', p_limit: 10, p_offset: 0 } },
    ]);
    expect(listed.data).toEqual([]);

    const resolve = mockRpc(null);
    expect(await resolveAdminReport(resolve.client, 'report-1', 'dismissed', 'not actionable')).toBeNull();
    expect(resolve.calls).toEqual([
      {
        name: 'admin_resolve_report',
        params: { p_report_id: 'report-1', p_status: 'dismissed', p_reason: 'not actionable' },
      },
    ]);
  });

  it('reads active Pages through RLS and offers no write path', async () => {
    const rows: AdminPageRow[] = [
      {
        id: 'page-1',
        slug: 'nub-connect',
        name: 'NUB Connect',
        kind: 'platform',
        description: 'Official page',
        verification_status: 'officially_verified',
        is_active: true,
      },
    ];
    const { client, calls, builder } = mockPages({ data: rows, error: null });
    const result = await loadAdminPages(client, 25);
    expect(calls).toContain('from:pages');
    expect(calls).toContain('eq:is_active:true');
    expect(builder.limit).toHaveBeenCalledWith(25);
    expect(result.data).toEqual(rows);

    const denied = mockPages({ data: null, error: { message: 'RLS denied' } });
    expect((await loadAdminPages(denied.client)).error).toBe('RLS denied');
  });
});
