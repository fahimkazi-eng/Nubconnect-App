// ============================================================================
// NUBCONNECT — Editorial review (pure mapping)
// ----------------------------------------------------------------------------
// The Content area shows launch/seed posts exactly as the
// `admin_list_launch_content` RPC returns them. This module contains only pure
// helpers: no Supabase calls, no writes and no invented scheduling data.
//
// The database records provenance and publication status, but it has no
// scheduling RPC (and no scheduled-at column). Month headings are a review
// view of recorded dates, never a claim that posts can be queued.
// ============================================================================
import type { LaunchContentRow } from './admin';

export type EditorialAction = 'archive' | 'restore';

export interface EditorialAvailability {
  allowed: boolean;
  /** The real reason a control is unavailable, or null when it can be used. */
  reason: string | null;
}

export interface EditorialMonthGroup {
  /** `YYYY-MM`, or `undated` when neither date was recorded. */
  key: string;
  label: string;
  rows: LaunchContentRow[];
}

export const EDITORIAL_REVIEW_NOTE =
  'Editorial review only: these are the seed/launch posts returned by admin_list_launch_content, with their recorded source, rights, reviewer and publication status. Student posts are not included.';

export const EDITORIAL_VERIFICATION_NOTE =
  'Verification / review shows only the internal reviewer and publication status recorded on the post. The launch-content RPC does not return a Page verification flag, so no external verification is implied.';

export const EDITORIAL_GROUPING_NOTE =
  'Grouped by original publication date where it was recorded, otherwise by import date. These are review buckets, not scheduled publish slots.';

export const SCHEDULING_UNAVAILABLE =
  'Requires backend support — scheduling launch posts is not available. No admin RPC sets a publish date, and the database has no scheduled-at field.';

export const MODERATION_SCOPE_NOTE =
  'Club and Department Admins can only moderate content on Pages they manage; the database enforces that when the action runs.';

export const PAGES_READ_ONLY_NOTE =
  'Read-only: RLS returns active Pages only. No admin RPC exists to transfer ownership, approve verification or change Page leadership.';

/** UTC month key so a timestamp cannot drift into a neighbouring month. */
export function editorialDateKey(iso: string | null | undefined): string {
  if (!iso) return 'undated';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'undated';
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function editorialMonthLabel(key: string): string {
  if (key === 'undated') return 'Date not recorded';
  const [year, month] = key.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return key;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** Prefer the original publication date; fall back to the import date. */
export function editorialReviewDate(
  row: Pick<LaunchContentRow, 'original_published_at' | 'created_at'>,
): string | null {
  return row.original_published_at ?? row.created_at ?? null;
}

export function groupEditorialByMonth(rows: readonly LaunchContentRow[]): EditorialMonthGroup[] {
  const buckets = new Map<string, LaunchContentRow[]>();
  for (const row of rows) {
    const key = editorialDateKey(editorialReviewDate(row));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => {
      if (a === 'undated') return 1;
      if (b === 'undated') return -1;
      return b.localeCompare(a);
    })
    .map(([key, groupRows]) => ({ key, label: editorialMonthLabel(key), rows: groupRows }));
}

export function editorialSourceLabel(row: Pick<LaunchContentRow, 'source_organization'>): string {
  return row.source_organization?.trim() || 'Source not recorded';
}

export function editorialRightsLabel(row: Pick<LaunchContentRow, 'content_rights'>): string {
  return row.content_rights?.trim() || 'Rights not recorded';
}

/** Honest review status derived only from the field the RPC actually returns. */
export function editorialVerificationLabel(
  row: Pick<LaunchContentRow, 'internal_reviewer'>,
): string {
  const reviewer = row.internal_reviewer?.trim();
  return reviewer ? `Reviewed by ${reviewer}` : 'No reviewer recorded';
}

export function editorialPublicationLabel(
  row: Pick<LaunchContentRow, 'publication_status' | 'is_hidden'>,
): string {
  const status = row.publication_status?.trim() || 'Status not recorded';
  return row.is_hidden ? `${status} · hidden from students` : status;
}

/** The action that matches the current state; the RPC also supports `hide`. */
export function editorialActionFor(
  row: Pick<LaunchContentRow, 'is_hidden' | 'publication_status'>,
): EditorialAction {
  return row.is_hidden || row.publication_status === 'archived' ? 'restore' : 'archive';
}

/**
 * Client-side affordance only. The SECURITY DEFINER RPC remains the authority:
 * it re-checks `content.moderate`, Page scope and archive eligibility at call
 * time. A disabled button here never grants anything.
 */
export function moderationAvailability(
  row: Pick<LaunchContentRow, 'is_hidden' | 'publication_status' | 'removal_eligible'>,
  options: { canModerate: boolean; isSuperAdmin: boolean },
): Record<EditorialAction, EditorialAvailability> {
  if (!options.canModerate) {
    const denied: EditorialAvailability = { allowed: false, reason: 'Your role cannot moderate content.' };
    return { archive: { ...denied }, restore: { ...denied } };
  }

  const archive: EditorialAvailability =
    row.publication_status === 'archived'
      ? { allowed: false, reason: 'Already archived.' }
      : !row.removal_eligible && !options.isSuperAdmin
        ? { allowed: false, reason: 'Protected from removal — only a Super Admin may archive it.' }
        : { allowed: true, reason: null };

  const restore: EditorialAvailability =
    !row.is_hidden && row.publication_status !== 'archived'
      ? { allowed: false, reason: 'Already visible to students.' }
      : { allowed: true, reason: null };

  return { archive, restore };
}
