// ============================================================================
// NUBCONNECT — People discovery (real profiles)
//
// The people a student may discover come from the `profiles` table, filtered by
// the privacy-aware profile policies in migration 006: a student sees the
// people their university makes visible to them, and nobody else.
//
// Nothing here invents a student. When the campus has no other members yet,
// the directory is simply empty and the interface says so.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person } from './types';

export interface PersonProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  is_verified_student?: boolean | null;
  is_suspended?: boolean | null;
  department_id?: string | null;
  semester_label?: string | null;
  primary_university_id?: string | null;
  departments?: { code: string | null; name: string | null } | null;
}

/** Map a profile row into the person card the interface renders. */
export function mapProfileToPerson(row: PersonProfileRow): Person {
  return {
    id: row.id,
    name: row.display_name,
    username: row.username,
    departmentCode: row.departments?.code ?? 'NUB',
    departmentName: row.departments?.name ?? 'Northern University Bangladesh',
    semester: row.semester_label ?? 'Semester not set',
    intro: row.bio ?? '',
    interests: Array.isArray(row.interests) ? row.interests : [],
    isVerified: Boolean(row.is_verified_student),
    discoverable: !row.is_suspended,
    isNewAround: false,
  };
}

const PERSON_COLUMNS =
  'id, username, display_name, avatar_url, cover_url, bio, interests, is_verified_student, is_suspended, department_id, semester_label, primary_university_id, departments:department_id(code, name)';

/**
 * Load the people the signed-in student may discover.
 *
 * The query is deliberately narrow: no service-role key, no join that could
 * leak a private field, and the RLS policies decide who is visible. Page
 * identities — the account a Page publishes through — are not people, so they
 * never appear in the directory.
 */
export async function loadPeople(
  client: SupabaseClient | null,
  options: { viewerId?: string | null; departmentId?: string | null; limit?: number } = {},
): Promise<Person[]> {
  if (!client) return [];
  const limit = Math.min(options.limit ?? 24, 60);

  let request = client
    .from('profiles')
    .select(PERSON_COLUMNS)
    .eq('is_suspended', false)
    .order('display_name')
    .limit(limit);

  if (options.viewerId) request = request.neq('id', options.viewerId);
  if (options.departmentId) request = request.eq('department_id', options.departmentId);

  const { data, error } = await request;
  if (error || !data) return [];

  const rows = data as unknown as PersonProfileRow[];
  const pageIdentities = await loadPageIdentityIds(client);
  if (pageIdentities.length === 0) return rows.map(mapProfileToPerson);

  return rows
    .filter((row) => !pageIdentities.includes(row.id))
    .map(mapProfileToPerson);
}

/** The account ids that publish as a Page rather than as a person. */
async function loadPageIdentityIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('pages').select('owner_id');
  if (error || !data) return [];
  return (data as { owner_id: string | null }[])
    .map((p) => p.owner_id)
    .filter((id): id is string => Boolean(id));
}

/** The students in the viewer's own university — the closest thing to
 *  "people you may know" without inventing a ranking. */
export async function loadPeopleInUniversity(
  client: SupabaseClient | null,
  options: { universityId?: string | null; viewerId?: string | null; limit?: number } = {},
): Promise<Person[]> {
  if (!client) return [];
  const limit = Math.min(options.limit ?? 12, 40);

  let request = client
    .from('profiles')
    .select(PERSON_COLUMNS)
    .eq('is_suspended', false)
    .order('display_name')
    .limit(limit);

  if (options.universityId) request = request.eq('primary_university_id', options.universityId);
  if (options.viewerId) request = request.neq('id', options.viewerId);

  const { data, error } = await request;
  if (error || !data) return [];

  const rows = data as unknown as PersonProfileRow[];
  const pageIdentities = await loadPageIdentityIds(client);
  if (pageIdentities.length === 0) return rows.map(mapProfileToPerson);

  return rows.filter((row) => !pageIdentities.includes(row.id)).map(mapProfileToPerson);
}
