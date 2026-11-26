// ============================================================================
// NUBCONNECT — Real interest circles and course/project groups.
//
// A circle is a `community_groups` row with group_type = 'circle'. Its slug is
// the group's UUID, matching the links produced by loadCommunityGroups().
// Members come from `group_members`; posts and events are deliberately absent
// because this schema has no post/event-to-group link — the detail page shows
// an honest empty state instead of inventing activity.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Circle, Group } from './types';

export interface CircleMember {
  userId: string;
  name: string;
  username: string;
  role: string;
}

export interface CircleDetailData {
  circle: Circle;
  members: CircleMember[];
  myMembership: { role: string } | null;
  error?: string;
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  group_type: string | null;
  cover_url?: string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  rules: unknown;
}

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

function mapGroup(row: GroupRow, memberCount: number): Circle {
  const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
  return {
    slug: String(row.id),
    name: String(row.name ?? ''),
    category: 'Interest',
    description: String(row.description ?? ''),
    memberCount,
    rules: Array.isArray(row.rules) ? row.rules.filter((r): r is string => typeof r === 'string') : [],
    isDemo: false,
    logoUrl: text(row.avatar_url) ?? undefined,
    coverUrl: text(row.cover_url) ?? undefined,
    createdBy: text(row.created_by) ?? undefined,
  } as Circle & { logoUrl?: string; coverUrl?: string; createdBy?: string };
}

/** Load one real circle by its UUID slug, plus its real member roster. */
export async function loadCircleDetail(
  client: SupabaseClient | null,
  slug: string,
  userId?: string | null,
): Promise<{ data: CircleDetailData | null; error?: string }> {
  if (!client || !UUID_PATTERN.test(slug)) return { data: null };
  const { data: group, error } = await client
    .from('community_groups')
    .select('id, name, description, group_type, cover_url, avatar_url, created_by, rules')
    .eq('id', slug)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!group || (group as GroupRow).group_type !== 'circle') return { data: null };

  const row = group as GroupRow;
  const { data: memberRows, error: membersError } = await client
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', row.id);
  if (membersError) return { data: null, error: membersError.message };

  const memberRowsList = (memberRows ?? []) as { user_id: string; role: string }[];
  const memberIds = memberRowsList.map((m) => String(m.user_id));
  const profiles = memberIds.length
    ? await client.from('profiles').select('id, display_name, username').in('id', memberIds)
    : null;
  const names = new Map(
    ((profiles?.data ?? []) as { id: string; display_name: string | null; username: string | null }[]).map(
      (p) => [String(p.id), { name: String(p.display_name ?? 'NUB student'), username: String(p.username ?? '') }],
    ),
  );

  const mine = memberRowsList.find((m) => String(m.user_id) === userId);
  return {
    data: {
      circle: mapGroup(row, memberRowsList.length),
      members: memberRowsList.map((m) => ({
        userId: String(m.user_id),
        name: names.get(String(m.user_id))?.name ?? 'NUB student',
        username: names.get(String(m.user_id))?.username ?? '',
        role: String(m.role ?? 'member'),
      })),
      myMembership: mine ? { role: String(mine.role ?? 'member') } : null,
    },
  };
}

export interface GroupDetailData {
  group: Group;
  members: CircleMember[];
  myMembership: { role: string } | null;
  rules: string[];
  error?: string;
}

/** Load one real study/course group by its UUID slug, plus its real roster. */
export async function loadGroupDetail(
  client: SupabaseClient | null,
  slug: string,
  userId?: string | null,
): Promise<{ data: GroupDetailData | null; error?: string }> {
  if (!client || !UUID_PATTERN.test(slug)) return { data: null };
  const { data: group, error } = await client
    .from('community_groups')
    .select('id, name, description, group_type, cohort_or_semester, rules')
    .eq('id', slug)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!group || (group as GroupRow).group_type !== 'group') return { data: null };

  const row = group as GroupRow & { cohort_or_semester?: string | null };
  const { data: memberRows, error: membersError } = await client
    .from('group_members')
    .select('user_id, role')
    .eq('group_id', row.id);
  if (membersError) return { data: null, error: membersError.message };

  const memberRowsList = (memberRows ?? []) as { user_id: string; role: string }[];
  const memberIds = memberRowsList.map((m) => String(m.user_id));
  const profiles = memberIds.length
    ? await client.from('profiles').select('id, display_name, username').in('id', memberIds)
    : null;
  const names = new Map(
    ((profiles?.data ?? []) as { id: string; display_name: string | null; username: string | null }[]).map(
      (p) => [String(p.id), { name: String(p.display_name ?? 'NUB student'), username: String(p.username ?? '') }],
    ),
  );

  const mine = memberRowsList.find((m) => String(m.user_id) === userId);
  const groupType: Group['type'] = String(row.cohort_or_semester ?? '').includes('Course')
    ? 'Course'
    : 'Interest';

  return {
    data: {
      group: {
        slug: String(row.id),
        name: String(row.name ?? ''),
        type: groupType,
        description: String(row.description ?? ''),
        memberCount: memberRowsList.length,
        joined: Boolean(mine),
        isDemo: false,
      },
      members: memberRowsList.map((m) => ({
        userId: String(m.user_id),
        name: names.get(String(m.user_id))?.name ?? 'NUB student',
        username: names.get(String(m.user_id))?.username ?? '',
        role: String(m.role ?? 'member'),
      })),
      myMembership: mine ? { role: String(mine.role ?? 'member') } : null,
      rules: Array.isArray(row.rules) ? row.rules.filter((r): r is string => typeof r === 'string') : [],
    },
  };
}

/**
 * Join or leave a real group. Both writes are scoped to the signed-in user;
 * the UI never deletes or inserts a membership belonging to someone else.
 */
export async function setCircleMembership(
  client: SupabaseClient,
  input: { groupId: string; userId: string; join: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (input.join) {
    const { error } = await client.from('group_members').insert({
      group_id: input.groupId,
      user_id: input.userId,
      role: 'member',
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { error } = await client
    .from('group_members')
    .delete()
    .eq('group_id', input.groupId)
    .eq('user_id', input.userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Read the signed-in student's real memberships once, so the circle and group
 * directories never rely on the demo-mode localStorage join list.
 */
export async function loadJoinedGroupIds(
  client: SupabaseClient,
  userId: string,
): Promise<{ ids: string[]; error?: string }> {
  if (!UUID_PATTERN.test(userId)) return { ids: [] };
  const { data, error } = await client
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (error) return { ids: [], error: error.message };
  return {
    ids: ((data ?? []) as { group_id: string }[]).map((row) => String(row.group_id)),
  };
}
