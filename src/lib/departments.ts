// ============================================================================
// NUBCONNECT — Department pages from real university data.
//
// A department detail page combines four RLS-protected surfaces: the department
// row, posts tagged with that department, discoverable students in it, and
// organizations linked to it. No sample people or sample posts are injected.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadDepartments, mapOrganizationRow } from './data';
import { loadPeople } from './people';
import { loadFeedPosts } from './posts';
import type { Club, Department, Person, Post } from './types';

export interface DepartmentCourse {
  id: string;
  code: string;
  title: string;
  creditHours: number;
}

export interface DepartmentEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  venue: string;
  sourceUrl: string | null;
}

export interface DepartmentDiscussion {
  id: string;
  name: string;
  description: string;
}

export interface DepartmentResource {
  id: string;
  title: string;
  type: string;
  courseCode: string;
  attribution: string;
  downloadUrl: string;
}

export interface DepartmentDetail {
  department: Department;
  posts: Post[];
  students: Person[];
  clubs: Club[];
  courses: DepartmentCourse[];
  events: DepartmentEvent[];
  discussions: DepartmentDiscussion[];
  resources: DepartmentResource[];
}

/** Find one department by its code, case-insensitively. */
export async function loadDepartmentByCode(
  client: SupabaseClient | null,
  code: string,
): Promise<Department | null> {
  if (!client || !code) return null;
  const departments = await loadDepartments(client);
  return (
    departments.find((d) => d.code.toLowerCase() === code.toLowerCase()) ??
    departments.find((d) => d.code.toLowerCase().replace(/\s/g, '') === code.toLowerCase()) ??
    null
  );
}

/** Load the real clubs linked to one department row. */
export async function loadClubsByDepartment(
  client: SupabaseClient,
  departmentId: string,
): Promise<Club[]> {
  const { data, error } = await client
    .from('organizations')
    .select('*')
    .eq('department_id', departmentId)
    .order('name')
    .limit(50);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapOrganizationRow);
}

async function loadDepartmentCourses(
  client: SupabaseClient,
  departmentId: string,
): Promise<DepartmentCourse[]> {
  const { data, error } = await client
    .from('courses')
    .select('id, course_code, title, credit_hours')
    .eq('department_id', departmentId)
    .order('course_code')
    .limit(50);
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    code: String(row.course_code ?? ''),
    title: String(row.title ?? ''),
    creditHours: Number(row.credit_hours ?? 0),
  }));
}

async function loadDepartmentEvents(
  client: SupabaseClient,
  departmentId: string,
): Promise<DepartmentEvent[]> {
  const { data, error } = await client
    .from('events')
    .select('id, title, event_date, start_time, venue_or_format, source_url')
    .eq('department_id', departmentId)
    .order('event_date', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    date: String(row.event_date ?? ''),
    startTime: row.start_time ? String(row.start_time) : null,
    venue: String(row.venue_or_format ?? ''),
    sourceUrl: row.source_url ? String(row.source_url) : null,
  }));
}

async function loadDepartmentDiscussions(
  client: SupabaseClient,
  departmentId: string,
): Promise<DepartmentDiscussion[]> {
  const { data, error } = await client
    .from('community_groups')
    .select('id, name, description')
    .eq('department_id', departmentId)
    .order('name')
    .limit(30);
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
  }));
}

async function loadDepartmentResources(
  client: SupabaseClient,
  departmentId: string,
): Promise<DepartmentResource[]> {
  const { data, error } = await client
    .from('course_resources')
    .select('id, title, resource_type, course_code, attribution_note, download_url')
    .eq('department_id', departmentId)
    .order('title')
    .limit(50);
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    type: String(row.resource_type ?? ''),
    courseCode: String(row.course_code ?? ''),
    attribution: String(row.attribution_note ?? ''),
    downloadUrl: String(row.download_url ?? ''),
  }));
}

/** Load one department page with only records the viewer is allowed to see. */
export async function loadDepartmentDetail(
  client: SupabaseClient | null,
  code: string,
  viewerId: string | null,
): Promise<DepartmentDetail | null> {
  if (!client) return null;
  const department = await loadDepartmentByCode(client, code);
  if (!department) return null;

  const empty = {
    posts: [] as Post[],
    students: [] as Person[],
    clubs: [] as Club[],
    courses: [] as DepartmentCourse[],
    events: [] as DepartmentEvent[],
    discussions: [] as DepartmentDiscussion[],
    resources: [] as DepartmentResource[],
  };
  if (!department.id) return { department, ...empty };

  const [posts, students, clubs, courses, events, discussions, resources] = await Promise.all([
    loadFeedPosts(client, { viewerId, departmentId: department.id, limit: 20 }),
    loadPeople(client, { viewerId, departmentId: department.id, limit: 40 }),
    loadClubsByDepartment(client, department.id),
    loadDepartmentCourses(client, department.id),
    loadDepartmentEvents(client, department.id),
    loadDepartmentDiscussions(client, department.id),
    loadDepartmentResources(client, department.id),
  ]);
  return { department, posts, students, clubs, courses, events, discussions, resources };
}
