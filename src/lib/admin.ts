// ============================================================================
// NUBCONNECT — Admin command centre data contract
// ----------------------------------------------------------------------------
// Every function here calls a SECURITY DEFINER RPC that authorizes the caller
// inside the database. The UI never decides who is allowed to do what: it only
// reflects `admin_my_access()` so staff don't see controls they cannot use.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'moderator'
  | 'department_admin'
  | 'club_admin'
  | 'support_admin';

export type AdminPermission =
  | 'roles.manage'
  | 'features.manage'
  | 'pages.manage'
  | 'users.view'
  | 'users.verify'
  | 'users.suspend'
  | 'content.moderate'
  | 'reports.resolve'
  | 'pulse.monitor'
  | 'audit.read';

export interface AdminAccess {
  is_admin: boolean;
  is_super_admin: boolean;
  roles: AdminRole[];
  permissions: Record<AdminPermission, boolean>;
}

export const EMPTY_ADMIN_ACCESS: AdminAccess = {
  is_admin: false,
  is_super_admin: false,
  roles: [],
  permissions: {
    'roles.manage': false,
    'features.manage': false,
    'pages.manage': false,
    'users.view': false,
    'users.verify': false,
    'users.suspend': false,
    'content.moderate': false,
    'reports.resolve': false,
    'pulse.monitor': false,
    'audit.read': false,
  },
};

export interface AdminDashboard {
  generated_at: string;
  people: {
    registered_students: number;
    verified_students: number;
    suspended_accounts: number;
    new_students_7d: number;
    active_30d: number | null;
    unconfirmed_signups: number | null;
    administrators: number;
  };
  content: {
    posts: number;
    comments: number;
    reactions: number;
    pages: number;
    page_followers: number;
    clubs: number;
    club_memberships: number;
    events: number;
    marketplace_listings: number;
    room_listings: number;
    launch_posts: number;
  };
  pulse: {
    available_now: number;
    open_activities: number;
    reported_activities: number;
  };
  moderation: {
    pending_reports: number;
    pending_student_verifications: number;
    pending_club_verifications: number;
  };
  storage: {
    bytes_total: number | null;
    bytes_uploaded_7d: number | null;
    large_files: number | null;
  };
  health: {
    database_bytes: number | null;
    server_time: string;
  };
  unavailable: string[];
}

export interface AdminUserRow {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  department_name: string | null;
  is_verified_student: boolean;
  is_suspended: boolean;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
}

export interface LaunchContentRow {
  id: string;
  title: string | null;
  body_preview: string;
  page_name: string | null;
  seed_batch: string | null;
  source_organization: string | null;
  source_url: string | null;
  content_rights: string | null;
  internal_reviewer: string | null;
  publication_status: string;
  is_hidden: boolean;
  removal_eligible: boolean;
  original_published_at: string | null;
  created_at: string;
}

/** The active-Page fields RLS returns to the browser. Read-only, never written. */
export interface AdminPageRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: string | null;
  verification_status: string;
  is_active: boolean;
}

export interface AdminReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason_category: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter_name: string;
  reporter_username: string;
}

export interface FeatureFlagRow {
  key: FeatureKey;
  enabled: boolean;
  updated_at: string | null;
  description: string;
}

export type FeatureKey = 'campus_pulse' | 'marketplace' | 'roommates' | 'stories';

export interface AdminAuditRow {
  id: string;
  action_type: string;
  target_table: string;
  target_record_id: string;
  reason: string | null;
  actor_name: string;
  actor_role: string;
  created_at: string;
}

/** The labels staff actually read. Kept here so tests can pin them. */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  department_admin: 'Department Admin',
  club_admin: 'Club Admin',
  support_admin: 'Support Admin',
};

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  'roles.manage': 'Manage administrative roles',
  'features.manage': 'Manage platform features',
  'pages.manage': 'Manage official Pages',
  'users.view': 'View student accounts',
  'users.verify': 'Review verification',
  'users.suspend': 'Suspend and restore accounts',
  'content.moderate': 'Moderate content',
  'reports.resolve': 'Resolve reports',
  'pulse.monitor': 'Monitor Campus Pulse',
  'audit.read': 'Read the audit trail',
};

/** Bytes → a short, human-readable size. `null` means "not measured". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return 'Not measured';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** A count the database could not measure is shown honestly, never as zero. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not measured';
  return new Intl.NumberFormat('en-US').format(value);
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'No role';
  return ADMIN_ROLE_LABELS[role as AdminRole] ?? role.replaceAll('_', ' ');
}

export function can(access: AdminAccess | null, permission: AdminPermission): boolean {
  return Boolean(access?.is_admin && access.permissions[permission]);
}

export function hasAnyAdminRole(access: AdminAccess | null): boolean {
  return Boolean(access?.is_admin);
}

// --- RPC wrappers -----------------------------------------------------------
// Each returns `{ data, error }`-style results so the page can surface real
// failures instead of pretending a write succeeded.

type RpcResult<T> = { data: T | null; error: string | null };

async function rpc<T>(supabase: SupabaseClient, name: string, params?: Record<string, unknown>): Promise<RpcResult<T>> {
  const { data, error } = await supabase.rpc(name, params);
  return { data: (data as T) ?? null, error: error?.message ?? null };
}

function withDefaults(raw: unknown): AdminAccess {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ADMIN_ACCESS, permissions: { ...EMPTY_ADMIN_ACCESS.permissions } };
  const value = raw as Partial<AdminAccess>;
  return {
    is_admin: Boolean(value.is_admin),
    is_super_admin: Boolean(value.is_super_admin),
    roles: Array.isArray(value.roles) ? (value.roles as AdminRole[]) : [],
    permissions: {
      ...EMPTY_ADMIN_ACCESS.permissions,
      ...(value.permissions ?? {}),
    },
  };
}

export async function loadAdminAccess(supabase: SupabaseClient): Promise<AdminAccess> {
  const { data } = await rpc<unknown>(supabase, 'admin_my_access');
  return withDefaults(data);
}

export async function loadAdminDashboard(supabase: SupabaseClient): Promise<RpcResult<AdminDashboard>> {
  return rpc<AdminDashboard>(supabase, 'admin_dashboard');
}

export async function searchAdminUsers(
  supabase: SupabaseClient,
  query: string,
  limit = 25,
): Promise<RpcResult<AdminUserRow[]>> {
  return rpc<AdminUserRow[]>(supabase, 'admin_search_users', {
    p_query: query.trim() || null,
    p_limit: limit,
    p_offset: 0,
  });
}

export async function setStudentVerification(
  supabase: SupabaseClient,
  userId: string,
  approve: boolean,
  reason: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_set_verification', {
    p_user_id: userId,
    p_approve: approve,
    p_reason: reason,
  });
  return error?.message ?? null;
}

export async function setStudentSuspension(
  supabase: SupabaseClient,
  userId: string,
  suspend: boolean,
  reason: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_set_suspension', {
    p_user_id: userId,
    p_suspend: suspend,
    p_reason: reason,
  });
  return error?.message ?? null;
}

export async function assignAdminRole(
  supabase: SupabaseClient,
  userId: string,
  role: AdminRole,
  assign: boolean,
  reason: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_assign_role', {
    p_user_id: userId,
    p_role: role,
    p_assign: assign,
    p_reason: reason,
  });
  return error?.message ?? null;
}

export async function loadLaunchContent(
  supabase: SupabaseClient,
  batch: string | null,
  limit = 50,
): Promise<RpcResult<LaunchContentRow[]>> {
  return rpc<LaunchContentRow[]>(supabase, 'admin_list_launch_content', {
    p_batch: batch,
    p_limit: limit,
    p_offset: 0,
  });
}

export async function moderatePost(
  supabase: SupabaseClient,
  postId: string,
  action: 'hide' | 'restore' | 'archive',
  reason: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_moderate_post', {
    p_post_id: postId,
    p_action: action,
    p_reason: reason,
  });
  return error?.message ?? null;
}

/** Archive goes through the audited SECURITY DEFINER moderation RPC only. */
export function archiveLaunchPost(
  supabase: SupabaseClient,
  postId: string,
  reason: string,
): Promise<string | null> {
  return moderatePost(supabase, postId, 'archive', reason);
}

/** Restore goes through the audited SECURITY DEFINER moderation RPC only. */
export function restoreLaunchPost(
  supabase: SupabaseClient,
  postId: string,
  reason: string,
): Promise<string | null> {
  return moderatePost(supabase, postId, 'restore', reason);
}

/**
 * Read-only active Pages. This is an RLS read, not an admin RPC: migration 011
 * lets any authenticated reader see active Pages. It is deliberately read-only
 * because no admin RPC enforces Page ownership, approval or leadership changes.
 */
export async function loadAdminPages(
  supabase: SupabaseClient,
  limit = 50,
): Promise<RpcResult<AdminPageRow[]>> {
  const { data, error } = await supabase
    .from('pages')
    .select('id, slug, name, kind, description, verification_status, is_active')
    .eq('is_active', true)
    .order('name')
    .limit(limit);
  return { data: (data as AdminPageRow[] | null) ?? null, error: error?.message ?? null };
}

export async function loadAdminReports(
  supabase: SupabaseClient,
  status: string | null,
  limit = 50,
): Promise<RpcResult<AdminReportRow[]>> {
  return rpc<AdminReportRow[]>(supabase, 'admin_list_reports', {
    p_status: status,
    p_limit: limit,
    p_offset: 0,
  });
}

export async function resolveAdminReport(
  supabase: SupabaseClient,
  reportId: string,
  status: 'resolved' | 'dismissed',
  reason: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_report_id: reportId,
    p_status: status,
    p_reason: reason,
  });
  return error?.message ?? null;
}

export async function loadFeatureFlags(supabase: SupabaseClient): Promise<RpcResult<FeatureFlagRow[]>> {
  return rpc<FeatureFlagRow[]>(supabase, 'admin_feature_flags');
}

export async function setFeatureFlag(
  supabase: SupabaseClient,
  key: FeatureKey,
  enabled: boolean,
  reason: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_set_feature', {
    p_key: key,
    p_enabled: enabled,
    p_reason: reason,
  });
  return error?.message ?? null;
}

export async function setPlatformAnnouncement(
  supabase: SupabaseClient,
  message: string,
  active: boolean,
  reason: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('admin_set_announcement', {
    p_message: message,
    p_active: active,
    p_reason: reason,
  });
  return error?.message ?? null;
}

export async function loadAuditTrail(
  supabase: SupabaseClient,
  limit = 50,
): Promise<RpcResult<AdminAuditRow[]>> {
  return rpc<AdminAuditRow[]>(supabase, 'admin_list_audit', { p_limit: limit, p_offset: 0 });
}
