// ============================================================================
// NUBCONNECT — Campus events from the connected database.
//
// The `events` table holds published events with a real source URL and a
// recorded verification status. Nothing here invents an event, an organizer or
// a registration: registration stays disabled until an owner-scoped write path
// exists, because `event_registrations` has no RLS policy in this schema.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CampusEvent } from './types';

interface EventRow {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  venue_or_format: string | null;
  organization_id: string | null;
  department_id: string | null;
  verification_status: string | null;
  source_url: string | null;
}

function originLabel(status: string | null): string {
  switch (status) {
    case 'officially_verified':
      return 'Official';
    case 'department_verified':
      return 'Department';
    case 'club_verified':
    case 'recognized_organization':
      return 'Club';
    default:
      return 'Campus';
  }
}

/**
 * Load real published events. Organizer names come from the linked
 * organization or department rows; an event without either is still shown,
 * with the honest fallback "Campus" rather than a fabricated club name.
 */
export async function loadCampusEvents(
  client: SupabaseClient | null,
): Promise<{ events: CampusEvent[]; error?: string }> {
  if (!client) return { events: [] };
  const { data, error } = await client
    .from('events')
    .select(
      'id, title, event_date, start_time, venue_or_format, organization_id, department_id, verification_status, source_url',
    )
    .order('event_date', { ascending: false })
    .limit(50);
  if (error || !data) {
    return { events: [], error: error?.message ?? 'Events could not be loaded.' };
  }

  const rows = data as unknown as EventRow[];
  const orgIds = [...new Set(rows.map((r) => r.organization_id).filter((v): v is string => Boolean(v)))];
  const deptIds = [...new Set(rows.map((r) => r.department_id).filter((v): v is string => Boolean(v)))];

  const [orgs, departments] = await Promise.all([
    orgIds.length
      ? client.from('organizations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    deptIds.length
      ? client.from('departments').select('id, name').in('id', deptIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const orgNames = new Map(
    ((orgs.data ?? []) as { id: string; name: string }[]).map((r) => [String(r.id), String(r.name)]),
  );
  const deptNames = new Map(
    ((departments.data ?? []) as { id: string; name: string }[]).map((r) => [String(r.id), String(r.name)]),
  );

  return {
    events: rows.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      organizer:
        (row.organization_id && orgNames.get(row.organization_id)) ||
        (row.department_id && deptNames.get(row.department_id)) ||
        'Campus',
      venue: row.venue_or_format ? String(row.venue_or_format) : undefined,
      date: String(row.event_date ?? ''),
      startTime: row.start_time ? String(row.start_time) : undefined,
      originLabel: originLabel(row.verification_status),
      registered: false,
      isDemo: false,
      sourceUrl: row.source_url ? String(row.source_url) : undefined,
    })),
  };
}
