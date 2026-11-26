// ============================================================================
// NUBCONNECT — Campus Pulse (live presence and group activities)
//
// Campus Pulse is the signature experience: who is around campus, who is
// free to talk, and what people are planning right now.
//
// Three things are kept apart on purpose, because they are not the same:
//   • being online in the app        — a session, nothing more
//   • being on campus                 — a self-reported check-in that expires
//   • being available to interact     — an opt-in status with its own expiry
//
// Nothing here tracks a location. A student publishes their own status, the
// status expires on its own, and the database decides who may read it.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

/* --- The vocabulary -------------------------------------------------------- */

/** An availability status: what a student is offering, and for how long. */
export interface AvailabilityStatus {
  key: string;
  label: string;
  emoji: string;
  /** The intention this status expresses — the filter in Find Your Circle. */
  intent: string;
  /** Whether choosing this status means the student is physically on campus. */
  impliesOnCampus?: boolean;
}

/**
 * The availability statuses a student can publish. The wording follows the
 * product's own voice, and each one expires on its own.
 */
export const AVAILABILITY_STATUSES: readonly AvailabilityStatus[] = [
  { key: 'around_campus', label: "I'm around campus", emoji: '📍', intent: 'on_campus', impliesOnCampus: true },
  { key: 'free_to_chat', label: 'Free to chat', emoji: '💬', intent: 'free_to_chat' },
  { key: 'coffee_break', label: 'Looking for a coffee break', emoji: '☕', intent: 'coffee', impliesOnCampus: true },
  { key: 'hangout', label: 'Anyone up for a hangout?', emoji: '🙌', intent: 'hangout' },
  { key: 'study_together', label: "Let's study together", emoji: '📖', intent: 'study', impliesOnCampus: true },
  { key: 'teammates', label: 'Looking for teammates', emoji: '⚽', intent: 'sports' },
  { key: 'photography', label: 'Interested in photography', emoji: '📷', intent: 'photography' },
  { key: 'play_something', label: "Let's play something", emoji: '🎮', intent: 'gaming' },
  { key: 'exploring', label: 'Just exploring campus', emoji: '🚶', intent: 'on_campus', impliesOnCampus: true },
];

export const AVAILABILITY_BY_KEY: Readonly<Record<string, AvailabilityStatus>> = Object.fromEntries(
  AVAILABILITY_STATUSES.map((s) => [s.key, s]),
);

/** Older rows may predate the status vocabulary — label them honestly. */
export const FALLBACK_AVAILABILITY_STATUS: AvailabilityStatus = {
  key: 'available',
  label: 'Shared availability',
  emoji: '✨',
  intent: 'free_to_chat',
};

/** The intentions a student can filter the pulse by. */
export const PULSE_INTENTS: readonly { key: string; label: string; emoji: string }[] = [
  { key: 'all', label: 'Everyone', emoji: '✨' },
  { key: 'on_campus', label: 'On campus', emoji: '📍' },
  { key: 'free_to_chat', label: 'Free to chat', emoji: '💬' },
  { key: 'coffee', label: 'Coffee', emoji: '☕' },
  { key: 'hangout', label: 'Hangout', emoji: '🙌' },
  { key: 'study', label: 'Study', emoji: '📖' },
  { key: 'sports', label: 'Sports', emoji: '⚽' },
  { key: 'photography', label: 'Photography', emoji: '📷' },
  { key: 'gaming', label: 'Gaming', emoji: '🎮' },
];

/** The kinds of activity a student can organise. */
export const PULSE_ACTIVITY_CATEGORIES: readonly { key: string; label: string; emoji: string }[] = [
  { key: 'coffee_break', label: 'Coffee break', emoji: '☕' },
  { key: 'study_session', label: 'Study session', emoji: '📖' },
  { key: 'football', label: 'Football', emoji: '⚽' },
  { key: 'photography_walk', label: 'Photography walk', emoji: '📷' },
  { key: 'gaming', label: 'Gaming', emoji: '🎮' },
  { key: 'lunch_group', label: 'Lunch group', emoji: '🍛' },
  { key: 'campus_exploration', label: 'Campus exploration', emoji: '🚶' },
  { key: 'casual_hangout', label: 'Casual hangout', emoji: '🙌' },
];

export const PULSE_CATEGORY_BY_KEY: Readonly<Record<string, { label: string; emoji: string }>> =
  Object.fromEntries(PULSE_ACTIVITY_CATEGORIES.map((c) => [c.key, { label: c.label, emoji: c.emoji }]));

/** How long an availability lasts before it disappears on its own. */
export const AVAILABILITY_EXPIRY_OPTIONS: readonly { minutes: number; label: string }[] = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
  { minutes: 480, label: 'All afternoon' },
];

/* --- Shapes ---------------------------------------------------------------- */

export interface PulseAvailability {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  departmentCode: string;
  semester: string;
  interests: string[];
  status: AvailabilityStatus;
  message: string;
  /** General area only — never a precise location. */
  spot: string;
  onCampus: boolean;
  openToConnect: boolean;
  /** Who may see this availability — enforced by the database. */
  visibility: 'university' | 'verified_only' | 'circles' | 'private';
  campusAreaId: string | null;
  postedAt: string;
  expiresAt: string;
  isMine: boolean;
}

export interface PulseActivity {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  categoryEmoji: string;
  /** A real uploaded photograph, or null. Never a placeholder. */
  coverUrl: string | null;
  /** General meeting area only — never a private address. */
  spot: string;
  startsAt: string;
  durationMins: number;
  participantLimit: number;
  joinMode: 'open' | 'request';
  status: string;
  hostId: string;
  hostName: string;
  hostUsername: string;
  participants: { userId: string; name: string; username: string; avatarUrl: string | null }[];
  participantCount: number;
  isJoined: boolean;
  requestStatus?: 'pending' | 'accepted' | 'declined';
  isMine: boolean;
  isFull: boolean;
  /** Join requests waiting on the host — never shown to anyone else. */
  pendingRequests: {
    id: string;
    userId: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    note: string;
  }[];
}

export interface CampusArea {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

/* --- Row shapes ------------------------------------------------------------ */

export interface AvailabilityRow {
  id: string;
  user_id: string;
  activity: string;
  spot_note: string;
  note: string | null;
  posted_at: string;
  expires_at: string;
  open_to_connect: boolean;
  status_key: string | null;
  on_campus: boolean;
  visibility: string;
  campus_area_id: string | null;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified_student: boolean;
    semester_label: string | null;
    interests: string[] | null;
    departments: { code: string | null } | null;
  } | null;
}

export interface ActivityRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  cover_image_url: string | null;
  meeting_spot: string;
  starts_at: string;
  duration_minutes: number;
  participant_limit: number;
  join_mode: string;
  status: string;
  created_by: string;
  note: string | null;
  host: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  activity_plan_participants: {
    user_id: string;
    profiles: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
  }[] | null;
  activity_plan_requests:
    | {
        id: string;
        user_id: string;
        status: string;
        note: string | null;
        profiles: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
      }[]
    | null;
}

/* --- Mapping --------------------------------------------------------------- */

/** Friendly countdown for an availability, honest about expiry. */
export function remainingMinutes(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 60_000));
}

/** Map an availability row into the card the pulse renders. */
export function mapAvailabilityRow(row: AvailabilityRow, viewerId?: string | null): PulseAvailability {
  const status = row.status_key
    ? (AVAILABILITY_BY_KEY[row.status_key] ?? FALLBACK_AVAILABILITY_STATUS)
    : FALLBACK_AVAILABILITY_STATUS;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.profiles?.display_name ?? 'Student',
    username: row.profiles?.username ?? '',
    avatarUrl: row.profiles?.avatar_url ?? null,
    departmentCode: row.profiles?.departments?.code ?? 'NUB',
    semester: row.profiles?.semester_label ?? 'Semester not set',
    interests: Array.isArray(row.profiles?.interests) ? row.profiles.interests : [],
    status,
    message: row.note ?? '',
    spot: row.spot_note ?? '',
    onCampus: row.on_campus,
    openToConnect: row.open_to_connect,
    visibility:
      row.visibility === 'verified_only' || row.visibility === 'circles' || row.visibility === 'private'
        ? row.visibility
        : 'university',
    campusAreaId: row.campus_area_id,
    postedAt: row.posted_at,
    expiresAt: row.expires_at,
    isMine: viewerId ? row.user_id === viewerId : false,
  };
}

/** Map an activity row into the card the pulse renders. */
export function mapActivityRow(row: ActivityRow, viewerId?: string | null): PulseActivity {
  const participants = (row.activity_plan_participants ?? []).map((p) => ({
    userId: p.user_id,
    name: p.profiles?.display_name ?? 'Student',
    username: p.profiles?.username ?? '',
    avatarUrl: p.profiles?.avatar_url ?? null,
  }));

  const category = PULSE_CATEGORY_BY_KEY[row.category] ?? { label: row.category, emoji: '✨' };
  const myRequest = (row.activity_plan_requests ?? []).find((r) => r.user_id === viewerId);
  const requestStatus =
    myRequest?.status === 'accepted' || myRequest?.status === 'declined' || myRequest?.status === 'pending'
      ? myRequest.status
      : undefined;
  const pendingRequests = (row.activity_plan_requests ?? [])
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.profiles?.display_name ?? 'Student',
      username: r.profiles?.username ?? '',
      avatarUrl: r.profiles?.avatar_url ?? null,
      note: r.note ?? '',
    }));

  const participantCount = participants.length;
  const limit = row.participant_limit;

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? row.note ?? '',
    category: row.category,
    categoryLabel: category.label,
    categoryEmoji: category.emoji,
    coverUrl: row.cover_image_url ?? null,
    spot: row.meeting_spot,
    startsAt: row.starts_at,
    durationMins: row.duration_minutes,
    participantLimit: limit,
    joinMode: row.join_mode === 'request' ? 'request' : 'open',
    status: row.status,
    hostId: row.created_by,
    hostName: row.host?.display_name ?? 'A student',
    hostUsername: row.host?.username ?? '',
    participants,
    participantCount,
    isJoined: viewerId ? participants.some((p) => p.userId === viewerId) : false,
    requestStatus,
    isMine: viewerId ? row.created_by === viewerId : false,
    isFull: limit > 0 && participantCount >= limit,
    pendingRequests,
  };
}

/* --- Reads ----------------------------------------------------------------- */

/** Load who is around right now. */
export async function loadAvailability(
  client: SupabaseClient | null,
  options: { viewerId?: string | null } = {},
): Promise<PulseAvailability[]> {
  if (!client) return [];
  const { data, error } = await client
    .from('campus_now_statuses')
    .select(
      `id, user_id, activity, spot_note, note, posted_at, expires_at, open_to_connect, status_key, on_campus, visibility, campus_area_id,
       profiles:campus_now_statuses_user_id_fkey(id, username, display_name, avatar_url, is_verified_student, semester_label, interests, departments:department_id(code))`,
    )
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(100);

  if (error || !data) return [];
  return (data as unknown as AvailabilityRow[]).map((row) => mapAvailabilityRow(row, options.viewerId));
}

/** Load the group activities that are open or coming up. */
export async function loadActivities(
  client: SupabaseClient | null,
  options: { viewerId?: string | null; limit?: number } = {},
): Promise<PulseActivity[]> {
  if (!client) return [];
  const { data, error } = await client
    .from('activity_plans')
    .select(
      `id, title, description, category, cover_image_url, meeting_spot, starts_at, duration_minutes, participant_limit, join_mode, status, created_by, note,
       host:profiles!activity_plans_created_by_fkey(id, username, display_name, avatar_url),
       activity_plan_participants(user_id, profiles:profiles!activity_plan_participants_user_id_fkey(id, username, display_name, avatar_url)),
       activity_plan_requests(id, user_id, status, note, profiles:profiles!activity_plan_requests_user_id_fkey(id, username, display_name, avatar_url))`,
    )
    .eq('status', 'open')
    .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(options.limit ?? 40);

  if (error || !data) return [];
  return (data as unknown as ActivityRow[]).map((row) => mapActivityRow(row, options.viewerId));
}

/** Load the campus areas an administrator has configured. */
export async function loadCampusAreas(client: SupabaseClient | null): Promise<CampusArea[]> {
  if (!client) return [];
  const { data, error } = await client
    .from('pulse_campus_areas')
    .select('id, slug, name, description')
    .eq('is_active', true)
    .order('sort_order');
  if (error || !data) return [];
  return data as CampusArea[];
}

/* --- Actions --------------------------------------------------------------- */

export interface PublishAvailabilityInput {
  userId: string;
  universityId: string;
  statusKey: string;
  message?: string;
  spot?: string;
  campusAreaId?: string | null;
  onCampus?: boolean;
  openToConnect?: boolean;
  visibility?: 'university' | 'verified_only' | 'circles' | 'private';
  expiresInMinutes?: number;
}

/** Publish or replace the student's own availability. */
export async function publishAvailability(
  client: SupabaseClient | null,
  input: PublishAvailabilityInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: 'Not connected.' };

  const status = AVAILABILITY_BY_KEY[input.statusKey];
  if (!status) return { ok: false, error: 'That status is not available.' };

  const minutes = input.expiresInMinutes ?? 120;
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const onCampus = input.onCampus ?? Boolean(status.impliesOnCampus);

  const { error } = await client.from('campus_now_statuses').upsert(
    {
      university_id: input.universityId,
      user_id: input.userId,
      activity: status.label,
      status_key: status.key,
      spot_note: input.spot ?? '',
      note: input.message ?? '',
      on_campus: onCampus,
      open_to_connect: input.openToConnect ?? false,
      visibility: input.visibility ?? 'university',
      campus_area_id: input.campusAreaId ?? null,
      posted_at: new Date().toISOString(),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Take the student's availability down immediately. */
export async function clearAvailability(
  client: SupabaseClient | null,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false };
  const { error } = await client.from('campus_now_statuses').delete().eq('user_id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface CreateActivityInput {
  creatorId: string;
  universityId: string;
  title: string;
  description?: string;
  category: string;
  /** URL returned by the authorized storage API — never an invented placeholder. */
  coverImageUrl?: string | null;
  spot: string;
  startsAt: string;
  durationMins?: number;
  participantLimit?: number;
  joinMode?: 'open' | 'request';
}

/** Organise a group activity. */
export async function createActivity(
  client: SupabaseClient | null,
  input: CreateActivityInput,
): Promise<{ id?: string; error?: string }> {
  if (!client) return { error: 'Not connected.' };
  if (!input.title.trim()) return { error: 'Give the activity a title.' };

  const { data, error } = await client
    .from('activity_plans')
    .insert({
      university_id: input.universityId,
      created_by: input.creatorId,
      title: input.title.trim(),
      description: input.description ?? null,
      category: input.category,
      cover_image_url: input.coverImageUrl ?? null,
      meeting_spot: input.spot,
      starts_at: input.startsAt,
      duration_minutes: input.durationMins ?? 60,
      participant_limit: input.participantLimit ?? 5,
      join_mode: input.joinMode ?? 'open',
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !data) return { error: error?.message ?? 'Could not create that activity.' };
  return { id: data.id };
}

/** Join an open activity. */
export async function joinActivity(
  client: SupabaseClient | null,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false };
  const { data, error } = await client.rpc('join_activity', { p_plan: planId });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'That activity is full or no longer open.' };
  return { ok: true };
}

/** Leave an activity. */
export async function leaveActivity(
  client: SupabaseClient | null,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false };
  const { error } = await client.from('activity_plan_participants').delete().eq('plan_id', planId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Ask the host to let you join. */
export async function requestToJoin(
  client: SupabaseClient | null,
  input: { planId: string; userId: string; note?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false };
  const { error } = await client.from('activity_plan_requests').upsert(
    { plan_id: input.planId, user_id: input.userId, note: input.note ?? null, status: 'pending' },
    { onConflict: 'plan_id,user_id' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** The host accepts or declines a join request. */
export async function respondToJoinRequest(
  client: SupabaseClient | null,
  input: { requestId: string; planId: string; accept: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false };

  // The decision is made on the server: it checks that the caller hosts this
  // activity, nudges the request, and adds the participant in one step.
  const { data, error } = await client.rpc('decide_activity_request', {
    p_request: input.requestId,
    p_accept: input.accept,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'That request could not be decided — it may be full or closed.' };
  return { ok: true };
}

/* --- Activity lifecycle, reporting and linked chats ------------------------ */

/**
 * The report reasons already understood by the existing `reports` table.
 * Reporting must write a real row; there is no client-side "reported" flag.
 */
export const ACTIVITY_REPORT_REASONS = [
  { key: 'spam', label: 'Spam or misleading' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'inaccurate_official_claim', label: 'False official claim' },
  { key: 'privacy_violation', label: 'Privacy concern' },
] as const;

export type ActivityReportReason = (typeof ACTIVITY_REPORT_REASONS)[number]['key'];

export function isActivityReportReason(value: unknown): value is ActivityReportReason {
  return typeof value === 'string' && ACTIVITY_REPORT_REASONS.some((r) => r.key === value);
}

export interface ActivityReportInput {
  reporterId: string;
  universityId: string;
  planId: string;
  reasonCategory: ActivityReportReason | string;
  details?: string;
}

export interface ReportRow {
  university_id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason_category: string;
  details: string | null;
}

/** Pure builder: a report can only target a real row with a recognised reason. */
export function buildActivityReportRow(input: ActivityReportInput): ReportRow | null {
  if (!input.reporterId || !input.universityId || !input.planId) return null;
  if (!isActivityReportReason(input.reasonCategory)) return null;
  const details = input.details?.trim() ?? '';
  return {
    university_id: input.universityId,
    reporter_id: input.reporterId,
    target_type: 'activity_plan',
    target_id: input.planId,
    reason_category: input.reasonCategory,
    details: details ? details.slice(0, 1000) : null,
  };
}

/** Save a report through the existing table. Success means a row was written. */
export async function reportActivity(
  client: SupabaseClient | null,
  input: ActivityReportInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: 'Not connected.' };
  const row = buildActivityReportRow(input);
  if (!row) return { ok: false, error: 'Choose a valid reason for the report.' };

  const { data, error } = await client
    .from('reports')
    .insert(row)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: 'The report could not be saved.' };
  return { ok: true };
}

export interface ActivityLifecycleInput {
  planId: string;
  creatorId: string;
}

/**
 * Cancel an activity the caller actually hosts. The row is kept (never erased),
 * the status change is restricted to an open plan by RLS *and* by the query,
 * and only a confirmed write counts as success.
 */
export async function cancelActivity(
  client: SupabaseClient | null,
  input: ActivityLifecycleInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: 'Not connected.' };
  if (!input.planId || !input.creatorId) return { ok: false, error: 'Missing activity details.' };

  const { data, error } = await client
    .from('activity_plans')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', input.planId)
    .eq('created_by', input.creatorId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) {
    return { ok: false, error: 'Only the organiser can cancel an activity that is still open.' };
  }
  return { ok: true };
}

export interface ActivityCoverInput extends ActivityLifecycleInput {
  /** A URL returned by the authorized storage API, or null to clear it. */
  coverUrl: string | null;
}

/** Persist an uploaded cover on the organiser's own activity. */
export async function updateActivityCover(
  client: SupabaseClient | null,
  input: ActivityCoverInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: 'Not connected.' };
  if (!input.planId || !input.creatorId) return { ok: false, error: 'Missing activity details.' };

  const { data, error } = await client
    .from('activity_plans')
    .update({ cover_image_url: input.coverUrl, updated_at: new Date().toISOString() })
    .eq('id', input.planId)
    .eq('created_by', input.creatorId)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: 'Only the organiser can change this cover.' };
  return { ok: true };
}

/** Activity chats are only linked when a real conversation row carries the plan id. */
export function planIdFromConversationContext(context: unknown): string | null {
  if (!context || typeof context !== 'object') return null;
  const record = context as Record<string, unknown>;
  for (const key of ['plan_id', 'activity_plan_id']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

interface ConversationContextRow {
  id: string;
  context: Record<string, unknown> | null;
}

/**
 * Find only conversations that are actually stored with this activity's id in
 * their context. Nothing is created here: an unprovisioned group chat stays
 * explicitly unavailable rather than becoming a fake link.
 */
export async function loadActivityConversations(
  client: SupabaseClient | null,
  planIds: readonly string[],
): Promise<Record<string, string>> {
  if (!client || planIds.length === 0) return {};
  const ids = [...new Set(planIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const [byPlanId, byActivityPlanId] = await Promise.all([
    client
      .from('conversations')
      .select('id, context')
      .eq('status', 'active')
      .in('context->>plan_id', ids),
    client
      .from('conversations')
      .select('id, context')
      .eq('status', 'active')
      .in('context->>activity_plan_id', ids),
  ]);

  const linked: Record<string, string> = {};
  for (const result of [byPlanId, byActivityPlanId]) {
    for (const row of (result.data ?? []) as unknown as ConversationContextRow[]) {
      const planId = planIdFromConversationContext(row.context);
      if (planId && ids.includes(planId) && !linked[planId]) linked[planId] = row.id;
    }
  }
  return linked;
}

/* --- Live updates ---------------------------------------------------------- */

/**
 * Subscribe to live pulse changes.
 *
 * Availability, activities, participants and join requests all arrive over
 * one channel, so the interface updates without polling the server.
 */
export function subscribeToPulse(
  client: SupabaseClient | null,
  onChange: () => void,
): (() => void) | null {
  if (!client) return null;

  const channel = client
    .channel('campus-pulse')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campus_now_statuses' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_plans' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_plan_participants' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_plan_requests' }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
