// ============================================================================
// NUBCONNECT — Global campus search (real data only)
//
// One query box, many existing Supabase surfaces. Every read runs through the
// caller's browser client (anon key), so the RLS policies decide what may be
// seen: profile visibility (006), post audience (010), tenant isolation (003/
// 004) and the visibility rules on live Pulse rows (012). Nothing here uses a
// service role, a seed fixture or the DEMO dataset — an empty table stays
// empty, and a failed query is reported as an unavailable surface.
//
// Queries are deliberately narrow: a few columns, token-based `.or()` filters,
// explicit `.limit()` caps and a total-hit cap. No unbounded table scans.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { taka } from './format';

export type SearchKind =
  | 'Person'
  | 'Post'
  | 'Club'
  | 'Circle'
  | 'Group'
  | 'Department'
  | 'Event'
  | 'Pulse'
  | 'Product'
  | 'Room';

/** A backend surface, named separately from the result kind it produces. */
export type SearchSurface =
  | 'people'
  | 'posts'
  | 'clubs'
  | 'communities'
  | 'departments'
  | 'events'
  | 'pulse'
  | 'marketplace'
  | 'rooms';

export const SEARCH_SURFACES: readonly SearchSurface[] = [
  'people',
  'posts',
  'clubs',
  'communities',
  'departments',
  'events',
  'pulse',
  'marketplace',
  'rooms',
];

export const SEARCH_SURFACE_LABELS: Record<SearchSurface, string> = {
  people: 'People',
  posts: 'Posts',
  clubs: 'Clubs',
  communities: 'Circles & groups',
  departments: 'Departments',
  events: 'Events',
  pulse: 'Campus Pulse',
  marketplace: 'Marketplace',
  rooms: 'Rooms',
};

export const SEARCH_KIND_ORDER: readonly SearchKind[] = [
  'Person',
  'Circle',
  'Group',
  'Club',
  'Department',
  'Post',
  'Pulse',
  'Event',
  'Product',
  'Room',
];

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  /** An image URL returned by the backend, never generated demo art. */
  thumb?: string;
  seed?: string;
  /** A real NUB Verified flag — not a "demo" marker. */
  verified?: boolean;
}

export interface SearchGroup {
  kind: SearchKind;
  items: SearchHit[];
}

export interface SearchResult {
  hits: SearchHit[];
  groups: SearchGroup[];
  /** Surfaces whose query failed; results are only from the others. */
  unavailable: SearchSurface[];
  configured: boolean;
}

export interface SearchOptions {
  viewerId?: string | null;
}

const MAX_QUERY_TOKENS = 4;
const MAX_TOKEN_LENGTH = 40;
const PER_SURFACE_LIMIT = 8;
export const MAX_SEARCH_HITS = 40;

type Row = Record<string, unknown>;

interface QueryResponse<T> {
  data: T[] | null;
  error: { message?: string } | null;
}

/**
 * The small slice of PostgREST's filter builder this module uses. Supabase's
 * builder is structurally compatible; the cast keeps this layer testable with
 * a mock builder without pulling a database client into unit tests.
 */
interface FilterBuilder<T> extends PromiseLike<QueryResponse<T>> {
  or(filter: string): FilterBuilder<T>;
  eq(column: string, value: unknown): FilterBuilder<T>;
  gte(column: string, value: unknown): FilterBuilder<T>;
  neq(column: string, value: unknown): FilterBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): FilterBuilder<T>;
  limit(count: number): FilterBuilder<T>;
}

interface SearchContext {
  hits: SearchHit[];
  unavailable: Set<SearchSurface>;
}

/* --- Sanitisation ---------------------------------------------------------- */

/**
 * Turn free text into safe PostgREST search tokens.
 *
 * PostgREST `.or()` filters use `.`, `,`, parentheses and quotes as syntax, so
 * user input is reduced to Unicode letters, digits and whitespace. This keeps
 * a query like `CSE, name.ilike.%x%` from becoming a filter injection while
 * still supporting ordinary campus searches ("Nikunja 2", "Books Academic").
 */
export function sanitizeSearchQuery(input: string): string[] {
  const normalized = input
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_QUERY_TOKENS)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH).toLowerCase());
}

/** Build one `.or()` expression. Only call this with sanitized tokens. */
export function buildTextFilter(columns: readonly string[], token: string): string {
  return columns.map((column) => `${column}.ilike.%${token}%`).join(',');
}

function withTextFilters<T>(
  request: FilterBuilder<T>,
  columns: readonly string[],
  tokens: readonly string[],
): FilterBuilder<T> {
  let filtered = request;
  // Chained `.or()` calls are ANDed by PostgREST: every token must appear in
  // at least one of the searched columns.
  for (const token of tokens) filtered = filtered.or(buildTextFilter(columns, token));
  return filtered;
}

/* --- Mapping helpers ------------------------------------------------------- */

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function excerpt(value: unknown, max = 88): string {
  const text = str(value);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function imageUrl(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = nullableStr(entry);
      if (url) return url;
    }
  }
  return undefined;
}

function shortDate(value: unknown): string {
  const text = nullableStr(value);
  if (!text) return '';
  const time = Date.parse(text);
  if (Number.isNaN(time)) return text;
  return new Date(time).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* --- Query plumbing -------------------------------------------------------- */

function builder<T>(request: unknown): FilterBuilder<T> {
  return request as FilterBuilder<T>;
}

async function runQuery<T>(
  surface: SearchSurface,
  request: FilterBuilder<T>,
  map: (row: T) => SearchHit | null,
  ctx: SearchContext,
): Promise<void> {
  try {
    const { data, error } = await request;
    if (error || !data) {
      ctx.unavailable.add(surface);
      return;
    }
    for (const row of data) {
      if (ctx.hits.length >= MAX_SEARCH_HITS) return;
      const hit = map(row);
      if (hit) ctx.hits.push(hit);
    }
  } catch {
    ctx.unavailable.add(surface);
  }
}

/** Page identities publish as Pages, not as people — mirror people.ts. */
async function pageOwnerIds(client: SupabaseClient): Promise<Set<string> | null> {
  try {
    const request = builder<{ owner_id: string | null }>(
      client.from('pages').select('owner_id').eq('is_active', true).limit(200),
    );
    const { data, error } = await request;
    if (error || !data) return null;
    return new Set(
      data
        .map((row) => row.owner_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
  } catch {
    return null;
  }
}

interface ProfileRow extends Row {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  is_verified_student?: boolean | null;
  semester_label?: string | null;
  departments?: { code: string | null; name: string | null } | null;
}

async function searchPeople(
  client: SupabaseClient,
  tokens: readonly string[],
  options: SearchOptions,
  ctx: SearchContext,
): Promise<void> {
  // RLS on `profiles` (can_view_profile) enforces the student's own privacy
  // settings. We only add the guards the policy cannot express for us.
  const owners = await pageOwnerIds(client);
  if (!owners) {
    ctx.unavailable.add('people');
    return;
  }

  let request = builder<ProfileRow>(
    client
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, is_verified_student, semester_label, departments:department_id(code, name)',
      )
      .eq('is_suspended', false)
      .order('display_name')
      .limit(PER_SURFACE_LIMIT),
  );
  if (options.viewerId) request = request.neq('id', options.viewerId);
  request = withTextFilters(request, ['display_name', 'username', 'bio'], tokens);

  await runQuery('people', request, (row) => {
    if (!row.id || !row.username || !row.display_name || owners.has(row.id)) return null;
    const code = str(row.departments?.code, 'NUB');
    const semester = str(row.semester_label, 'Semester not set');
    return {
      id: `person-${row.id}`,
      kind: 'Person',
      title: row.display_name,
      subtitle: `${code} • ${semester}`,
      href: `/profile/${encodeURIComponent(row.username)}`,
      thumb: imageUrl(row.avatar_url),
      seed: row.id,
      verified: Boolean(row.is_verified_student),
    };
  }, ctx);
}

interface PostRow extends Row {
  id: string;
  title: string | null;
  body: string;
  category?: string | null;
  created_at?: string | null;
  author?: { display_name?: string | null } | null;
  media?: { media_url: string; media_type: string }[] | null;
}

async function searchPosts(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  // The posts SELECT policy (post_is_visible) already limits this to posts the
  // viewer may read. is_hidden is repeated here as defence in depth.
  let request = builder<PostRow>(
    client
      .from('posts')
      .select(
        'id, title, body, category, created_at, author:profiles!posts_author_id_fkey(display_name), media:post_media!post_media_post_id_fkey(media_url, media_type)',
      )
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['title', 'body', 'category'], tokens);

  await runQuery('posts', request, (row) => {
    if (!row.id) return null;
    const photo = (row.media ?? []).find((m) => m?.media_type === 'image');
    return {
      id: `post-${row.id}`,
      kind: 'Post',
      title: str(row.title) || excerpt(row.body),
      subtitle: `by ${str(row.author?.display_name, 'Student')}${
        str(row.category) ? ` • ${str(row.category)}` : ''
      }`,
      href: '/home',
      thumb: imageUrl(photo?.media_url),
      seed: row.id,
    };
  }, ctx);
}

interface ClubRow extends Row {
  id: string;
  slug: string;
  name: string;
  short_description?: string | null;
  about?: string | null;
  category?: string | null;
  logo_url?: string | null;
}

async function searchClubs(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  let request = builder<ClubRow>(
    client
      .from('organizations')
      .select('id, slug, name, short_description, about, category, logo_url')
      .order('name')
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['name', 'short_description', 'about', 'category'], tokens);

  await runQuery('clubs', request, (row) => {
    if (!row.id || !row.slug || !row.name) return null;
    return {
      id: `club-${row.id}`,
      kind: 'Club',
      title: row.name,
      subtitle: str(row.category) ? `${str(row.category)} club` : 'Campus club',
      href: `/clubs/${encodeURIComponent(row.slug)}`,
      thumb: imageUrl(row.logo_url),
      seed: row.slug,
    };
  }, ctx);
}

interface GroupRow extends Row {
  id: string;
  name: string;
  description?: string | null;
  group_type?: string | null;
  cohort_or_semester?: string | null;
  expires_at?: string | null;
  made_permanent_at?: string | null;
}

async function searchCommunities(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  let request = builder<GroupRow>(
    client
      .from('community_groups')
      .select(
        'id, name, description, group_type, cohort_or_semester, expires_at, made_permanent_at',
      )
      .order('name')
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['name', 'description'], tokens);

  await runQuery('communities', request, (row) => {
    if (!row.id || !row.name) return null;
    // Temporary circles expire unless members voted to keep them (004).
    if (row.expires_at && !row.made_permanent_at && Date.parse(row.expires_at) < Date.now()) {
      return null;
    }
    const isCircle = str(row.group_type) === 'circle';
    return {
      id: `${isCircle ? 'circle' : 'group'}-${row.id}`,
      kind: isCircle ? 'Circle' : 'Group',
      title: row.name,
      subtitle: str(row.cohort_or_semester, isCircle ? 'Interest circle' : 'Campus group'),
      // Both detail routes now load the real row by UUID from community_groups.
      href: `/${isCircle ? 'circles' : 'groups'}/${encodeURIComponent(row.id)}`,
      seed: row.id,
    };
  }, ctx);
}

interface DepartmentRow extends Row {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

async function searchDepartments(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  let request = builder<DepartmentRow>(
    client
      .from('departments')
      .select('id, code, name, description')
      .order('name')
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['code', 'name', 'description'], tokens);

  await runQuery('departments', request, (row) => {
    if (!row.id || !row.code || !row.name) return null;
    return {
      id: `department-${row.id}`,
      kind: 'Department',
      title: row.name,
      subtitle: `${row.code} • Department`,
      // The department detail page loads the real row by code.
      href: `/department/${encodeURIComponent(row.code.toLowerCase())}`,
      seed: row.id,
    };
  }, ctx);
}

interface EventRow extends Row {
  id: string;
  title: string;
  venue_or_format?: string | null;
  event_date?: string | null;
}

async function searchEvents(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  let request = builder<EventRow>(
    client
      .from('events')
      .select('id, title, venue_or_format, event_date')
      .order('event_date', { ascending: false })
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['title', 'description', 'venue_or_format'], tokens);

  await runQuery('events', request, (row) => {
    if (!row.id || !row.title) return null;
    return {
      id: `event-${row.id}`,
      kind: 'Event',
      title: row.title,
      subtitle: [str(row.venue_or_format), shortDate(row.event_date)].filter(Boolean).join(' • '),
      // No event-detail route exists; the Events page is the honest target.
      href: '/events',
      seed: row.id,
    };
  }, ctx);
}

interface ActivityRow extends Row {
  id: string;
  title: string;
  description?: string | null;
  meeting_spot?: string | null;
  starts_at?: string | null;
}

async function searchPulse(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  // Same live-window rule as pulse.ts; RLS confines rows to the viewer's
  // university and the visibility policy hides unavailable statuses.
  let request = builder<ActivityRow>(
    client
      .from('activity_plans')
      .select('id, title, description, meeting_spot, starts_at')
      .eq('status', 'open')
      .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('starts_at')
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['title', 'description', 'meeting_spot'], tokens);

  await runQuery('pulse', request, (row) => {
    if (!row.id || !row.title) return null;
    return {
      id: `pulse-${row.id}`,
      kind: 'Pulse',
      title: row.title,
      subtitle: [str(row.meeting_spot), shortDate(row.starts_at)].filter(Boolean).join(' • '),
      href: '/pulse',
      seed: row.id,
    };
  }, ctx);
}

interface ListingRow extends Row {
  id: string;
  title: string;
  price_bdt?: number | null;
  condition?: string | null;
  pickup_area?: string | null;
  photos?: string[] | null;
}

async function searchMarketplace(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  let request = builder<ListingRow>(
    client
      .from('marketplace_listings')
      .select('id, title, price_bdt, condition, pickup_area, photos')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['title', 'description', 'pickup_area'], tokens);

  await runQuery('marketplace', request, (row) => {
    if (!row.id || !row.title) return null;
    const price = Number(row.price_bdt ?? 0);
    const priceLabel = Number.isFinite(price) ? taka(price) : '';
    return {
      id: `product-${row.id}`,
      kind: 'Product',
      title: row.title,
      subtitle: [priceLabel, str(row.pickup_area), str(row.condition)]
        .filter(Boolean)
        .join(' • '),
      // The item detail page loads the real listing by id.
      href: `/marketplace/${encodeURIComponent(row.id)}`,
      thumb: imageUrl(row.photos),
      seed: row.id,
    };
  }, ctx);
}

interface RoomRow extends Row {
  id: string;
  title: string;
  general_area?: string | null;
  rent_bdt?: number | null;
  room_type?: string | null;
}

async function searchRooms(
  client: SupabaseClient,
  tokens: readonly string[],
  ctx: SearchContext,
): Promise<void> {
  // `room_rental_listings` is the rentable-rooms surface and has a public read
  // policy (003). `roommate_listings` is RLS deny-all (002 has no SELECT
  // policy), so it is deliberately not queried here.
  let request = builder<RoomRow>(
    client
      .from('room_rental_listings')
      .select('id, title, general_area, rent_bdt, room_type')
      .eq('status', 'active')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
      .limit(PER_SURFACE_LIMIT),
  );
  request = withTextFilters(request, ['title', 'general_area', 'description'], tokens);

  await runQuery('rooms', request, (row) => {
    if (!row.id || !row.title) return null;
    const rent = Number(row.rent_bdt ?? 0);
    return {
      id: `room-${row.id}`,
      kind: 'Room',
      title: row.title,
      subtitle: [str(row.general_area), Number.isFinite(rent) ? `${taka(rent)}/month` : '']
        .filter(Boolean)
        .join(' • '),
      // The room detail page loads the real listing by id.
      href: `/roommates/${encodeURIComponent(row.id)}`,
      seed: row.id,
    };
  }, ctx);
}

/* --- Public API ------------------------------------------------------------ */

/** Group hits by result kind in the canonical display order. */
export function groupHits(hits: readonly SearchHit[]): SearchGroup[] {
  return SEARCH_KIND_ORDER.map((kind) => ({
    kind,
    items: hits.filter((hit) => hit.kind === kind),
  })).filter((group): group is SearchGroup => group.items.length > 0);
}

/** Search every configured real surface. Never falls back to sample data. */
export async function searchCampus(
  client: SupabaseClient | null,
  rawQuery: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const tokens = sanitizeSearchQuery(rawQuery);
  const empty: SearchResult = { hits: [], groups: [], unavailable: [], configured: Boolean(client) };
  if (!client || tokens.length === 0) return empty;

  const ctx: SearchContext = { hits: [], unavailable: new Set<SearchSurface>() };
  await Promise.all([
    searchPeople(client, tokens, options, ctx),
    searchPosts(client, tokens, ctx),
    searchClubs(client, tokens, ctx),
    searchCommunities(client, tokens, ctx),
    searchDepartments(client, tokens, ctx),
    searchEvents(client, tokens, ctx),
    searchPulse(client, tokens, ctx),
    searchMarketplace(client, tokens, ctx),
    searchRooms(client, tokens, ctx),
  ]);

  const hits = ctx.hits.slice(0, MAX_SEARCH_HITS);
  return {
    hits,
    groups: groupHits(hits),
    unavailable: SEARCH_SURFACES.filter((surface) => ctx.unavailable.has(surface)),
    configured: true,
  };
}
