// Real circle detail: only database rows, with honest empty states and
// membership writes scoped to the signed-in user.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadCircleDetail,
  loadGroupDetail,
  loadJoinedGroupIds,
  setCircleMembership,
} from '../src/lib/circles';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';

function mockClient(overrides: {
  group?: unknown;
  groupError?: unknown;
  members?: unknown[];
  profiles?: unknown[];
} = {}) {
  const insertMock = vi.fn(async () => ({ error: null }));
  const deleteEqEqMock = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === 'community_groups') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: overrides.group ?? null,
              error: overrides.groupError ?? null,
            })),
          })),
        })),
      };
    }
    if (table === 'group_members') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: overrides.members ?? [], error: null })),
        })),
        insert: insertMock,
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: deleteEqEqMock,
          })),
        })),
      };
    }
    return {
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: overrides.profiles ?? [], error: null })),
      })),
    };
  });
  return { client: { from } as unknown as SupabaseClient, from, insertMock, deleteEqEqMock };
}

const group = {
  id: GROUP_ID,
  name: 'Photography Circle',
  description: 'Campus photography',
  group_type: 'circle',
  cover_url: null,
  rules: ['Be respectful'],
};

describe('loadCircleDetail', () => {
  it('does not query an invalid slug', async () => {
    const { client, from } = mockClient();
    const result = await loadCircleDetail(client, 'photography', 'u1');
    expect(result.data).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('maps a real circle and its members', async () => {
    const { client } = mockClient({
      group,
      members: [{ user_id: 'u1', role: 'member' }],
      profiles: [{ id: 'u1', display_name: 'QA Student', username: 'qa' }],
    });
    const result = await loadCircleDetail(client, GROUP_ID, 'u1');
    expect(result.error).toBeUndefined();
    expect(result.data?.circle).toMatchObject({
      slug: GROUP_ID,
      name: 'Photography Circle',
      memberCount: 1,
      isDemo: false,
    });
    expect(result.data?.members[0]).toMatchObject({ name: 'QA Student', username: 'qa' });
    expect(result.data?.myMembership).toEqual({ role: 'member' });
  });

  it('rejects a group that is not a circle', async () => {
    const { client } = mockClient({ group: { ...group, group_type: 'group' } });
    const result = await loadCircleDetail(client, GROUP_ID, 'u1');
    expect(result.data).toBeNull();
  });

  it('surfaces a backend error instead of an empty success', async () => {
    const { client } = mockClient({ groupError: { message: 'permission denied' } });
    const result = await loadCircleDetail(client, GROUP_ID, 'u1');
    expect(result.data).toBeNull();
    expect(result.error).toBe('permission denied');
  });
});

describe('loadGroupDetail', () => {
  const studyGroup = {
    ...group,
    name: 'DBMS Lab Group',
    group_type: 'group',
    cohort_or_semester: 'Course — CSE 7th',
  };

  it('does not query an invalid slug', async () => {
    const { client, from } = mockClient();
    const result = await loadGroupDetail(client, 'grp-dbms', 'u1');
    expect(result.data).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('maps a real group, its roster and its rules', async () => {
    const { client } = mockClient({
      group: studyGroup,
      members: [{ user_id: 'u1', role: 'member' }],
      profiles: [{ id: 'u1', display_name: 'QA Student', username: 'qa' }],
    });
    const result = await loadGroupDetail(client, GROUP_ID, 'u1');
    expect(result.error).toBeUndefined();
    expect(result.data?.group).toMatchObject({
      slug: GROUP_ID,
      name: 'DBMS Lab Group',
      type: 'Course',
      memberCount: 1,
      isDemo: false,
    });
    expect(result.data?.members[0]).toMatchObject({ name: 'QA Student', username: 'qa' });
    expect(result.data?.myMembership).toEqual({ role: 'member' });
    expect(result.data?.rules).toEqual(['Be respectful']);
  });

  it('rejects a circle that is not a group', async () => {
    const { client } = mockClient({ group });
    const result = await loadGroupDetail(client, GROUP_ID, 'u1');
    expect(result.data).toBeNull();
  });

  it('surfaces a backend error instead of an empty success', async () => {
    const { client } = mockClient({ groupError: { message: 'permission denied' } });
    const result = await loadGroupDetail(client, GROUP_ID, 'u1');
    expect(result.data).toBeNull();
    expect(result.error).toBe('permission denied');
  });
});

describe('loadJoinedGroupIds', () => {
  it('does not query without a valid student id', async () => {
    const from = vi.fn();
    const result = await loadJoinedGroupIds({ from } as unknown as SupabaseClient, 'demo');
    expect(result.ids).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('reads only the signed-in student’s group memberships', async () => {
    const eq = vi.fn(async () => ({
      data: [{ group_id: GROUP_ID }],
      error: null,
    }));
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq })) }));
    const result = await loadJoinedGroupIds(
      { from } as unknown as SupabaseClient,
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.ids).toEqual([GROUP_ID]);
    expect(eq).toHaveBeenCalled();
  });

  it('surfaces a backend error instead of claiming no memberships', async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: { message: 'permission denied' } })),
      })),
    }));
    const result = await loadJoinedGroupIds(
      { from } as unknown as SupabaseClient,
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.ids).toEqual([]);
    expect(result.error).toBe('permission denied');
  });
});

describe('setCircleMembership', () => {
  it('inserts only the signed-in user as a member', async () => {
    const { client, insertMock } = mockClient();
    const result = await setCircleMembership(client, { groupId: GROUP_ID, userId: 'u1', join: true });
    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({ group_id: GROUP_ID, user_id: 'u1', role: 'member' });
  });

  it('deletes only the signed-in user’s own membership', async () => {
    const { client, deleteEqEqMock } = mockClient();
    const result = await setCircleMembership(client, { groupId: GROUP_ID, userId: 'u1', join: false });
    expect(result.ok).toBe(true);
    expect(deleteEqEqMock).toHaveBeenCalledTimes(1);
  });
});
