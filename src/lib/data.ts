// ============================================================================
// NUBCONNECT — Data repository.
//
// One honest path for every surface:
//   • Backend configured  → queries the real Supabase tables through the RLS-
//     protected anon client (schema contract in supabase/migrations/001–011).
//     An empty table produces an empty list and an honest empty state — never
//     sample records dressed up as campus activity.
//   • No credentials      → returns the clearly-labelled DEMO dataset
//     (src/lib/demo/dataset.ts) so the product is explorable offline. The DEMO
//     dataset is a development fixture; it never reaches production.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMO_CLUBS, DEMO_DEPARTMENTS, DEMO_GROUPS, DEMO_CIRCLES } from './demo/dataset';
import type { Club, Department, Group, Circle } from './types';

const nullableStr = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export interface BackendStatus {
  configured: boolean;
  universityId: string | null;
  error: string | null;
}

/** Resolve the tenant (default university) for this deployment. */
export async function resolveTenant(
  client: SupabaseClient,
  slug: string,
): Promise<{ id: string; name: string; shortName: string } | null> {
  const { data, error } = await client
    .from('universities')
    .select('id, name, short_name')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, shortName: data.short_name };
}

/** Map a Supabase organizations row to the Club view model. */
export function mapOrganizationRow(row: Record<string, unknown>): Club {
  const statusMap: Record<string, Club['verificationStatus']> = {
    officially_verified: 'Officially Verified',
    department_verified: 'Department Verified',
    recognized_organization: 'Recognized Organization',
    awaiting_verification: 'Awaiting Verification',
    student_led: 'Student-Led',
  };
  const scopeMap: Record<string, Club['scope']> = {
    university_wide: 'University-Wide',
    department_specific: 'Departmental',
    central: 'Central',
  };
  return {
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    category: String(row.category ?? 'Community'),
    scope: scopeMap[String(row.scope_type ?? 'university_wide')] ?? 'University-Wide',
    verificationStatus:
      statusMap[String(row.verification_status ?? 'awaiting_verification')] ??
      'Awaiting Verification',
    about: String(row.about ?? row.short_description ?? ''),
    memberCount: Number(row.member_count ?? 0),
    isDemo: false,
  };
}

/** Load the club roster — real organizations when the backend is configured. */
export async function loadClubs(client: SupabaseClient | null): Promise<Club[]> {
  if (!client) return DEMO_CLUBS;
  const { data, error } = await client
    .from('organizations')
    .select('*')
    .order('name');
  if (error) return [];
  return (data as Record<string, unknown>[]).map(mapOrganizationRow);
}

/** Map a Supabase departments row to the Department view model. */
export function mapDepartmentRow(row: Record<string, unknown>): Department {
  return {
    id: row.id ? String(row.id) : undefined,
    code: String(row.code ?? row.slug ?? ''),
    name: String(row.name ?? ''),
    faculty: String(row.faculty_name ?? row.faculty ?? ''),
    semesterSystem:
      String(row.semester_system ?? '').includes('Bi-Semester')
        ? 'Bi-Semester'
        : 'Tri-Semester (16 Weeks)',
    verificationStatus: String(row.verification_status ?? 'Officially Verified'),
    description: String(row.description ?? ''),
    programs: Array.isArray(row.programs) ? (row.programs as string[]) : [],
    cohorts: Array.isArray(row.cohorts) ? (row.cohorts as string[]) : [],
    officialContact: String(row.official_contact ?? ''),
    sourceUrl: String(row.source_url ?? 'https://www.nub.ac.bd/'),
    isDemo: false,
    logoUrl: nullableStr(row.logo_url) ?? null,
    coverUrl: nullableStr(row.cover_url) ?? null,
  };
}

export async function loadDepartments(
  client: SupabaseClient | null,
): Promise<Department[]> {
  if (!client) return DEMO_DEPARTMENTS;
  const { data, error } = await client
    .from('departments')
    .select('*, faculties(name)')
    .order('name');
  if (error) return [];
  const mapped = (data as Record<string, unknown>[]).map((r) => ({
    ...mapDepartmentRow(r),
    faculty: String((r as { faculties?: { name?: string } }).faculties?.name ?? ''),
  }));
  return mapped;
}

/** Load interest circles and course/project groups (community_groups). */
export async function loadCommunityGroups(client: SupabaseClient | null): Promise<{
  circles: Circle[];
  groups: Group[];
}> {
  if (!client) return { circles: DEMO_CIRCLES, groups: DEMO_GROUPS };
  const { data, error } = await client
    .from('community_groups')
    .select('*, group_members(count)')
    .order('name');
  if (error) return { circles: [], groups: [] };
  const rows = data as Record<string, unknown>[];
  const circles: Circle[] = [];
  const groups: Group[] = [];
  for (const row of rows) {
    const memberCount = Number(
      ((row.group_members as { count: number }[] | null)?.[0]?.count ?? 0),
    );
    if (String(row.group_type ?? 'group') === 'circle') {
      circles.push({
        slug: String(row.id ?? row.name ?? '').slice(0, 40),
        name: String(row.name ?? ''),
        category: String(row.category ?? 'Interest'),
        description: String(row.description ?? ''),
        memberCount,
        rules: Array.isArray(row.rules) ? (row.rules as string[]) : [],
        isDemo: false,
      });
    } else {
      groups.push({
        slug: String(row.id ?? row.name ?? '').slice(0, 40),
        name: String(row.name ?? ''),
        type: (String(row.cohort_or_semester ?? 'Interest').includes('Course')
          ? 'Course'
          : ['Study', 'Project', 'Interest', 'Event', 'Department'].includes(
              String(row.group_kind ?? ''),
            )
            ? (String(row.group_kind) as Group['type'])
            : 'Interest'),
        description: String(row.description ?? ''),
        memberCount,
        joined: false,
        isDemo: false,
      });
    }
  }
  return { circles, groups };
}
