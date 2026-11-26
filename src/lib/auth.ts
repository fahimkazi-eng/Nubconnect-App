// ============================================================================
// NUBCONNECT — Account helpers (pure, unit-tested).
//
// Bridges Supabase auth/profile rows to the AppUser shape the UI renders, and
// holds the validation + privacy mapping used by the auth and settings forms.
// Nothing here talks to the network; see src/lib/supabase for clients.
// ============================================================================
import type { AppUser } from './types';

/** Google sign-in is offered only when the deployment explicitly enables it. */
export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === 'true';
}

/** Shape of the profile row selected by the app (subset of public.profiles). */
export interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  primary_university_id?: string | null;
  department_id?: string | null;
  semester_label?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  is_verified_student?: boolean | null;
  is_suspended?: boolean | null;
  departments?: { code: string | null; name: string | null } | null;
}

export interface PreferencesRow {
  profile_visibility?: string | null;
  show_semester?: boolean | null;
  allow_direct_messages?: string | null;
  notify_events?: boolean | null;
  notify_club_updates?: boolean | null;
  notify_roommate_inquiries?: boolean | null;
  show_in_honours?: boolean | null;
}

export type Discoverability = AppUser['discoverability'];
export type MessagingPermission = AppUser['allowMessages'];

export function discoverabilityFromDb(value?: string | null): Discoverability {
  if (value === 'public') return 'Public';
  if (value === 'verified_only') return 'Verified Students Only';
  return 'University Students Only';
}

export function discoverabilityToDb(value: Discoverability): string {
  if (value === 'Public') return 'public';
  if (value === 'Verified Students Only') return 'verified_only';
  return 'university_only';
}

export function messagingFromDb(value?: string | null): MessagingPermission {
  if (value === 'anyone') return 'Anyone';
  // The schema calls this legacy value "verified_students"; the UI expresses
  // it as the broader university-student audience.
  if (value === 'verified_students' || value === 'university_students') return 'University Students Only';
  // 'requests_only' and 'none' both route through consent in this build.
  return 'Consent Requests Only';
}

export function messagingToDb(value: MessagingPermission): string {
  if (value === 'Anyone') return 'anyone';
  if (value === 'University Students Only') return 'verified_students';
  return 'requests_only';
}

/** Map an authenticated profile row into the identity every surface renders. */
export function mapProfileToAppUser(profile: ProfileRow, email?: string | null): AppUser {
  const departmentCode = profile.departments?.code ?? 'NUB';
  const departmentName = profile.departments?.name ?? 'Northern University Bangladesh';
  return {
    id: profile.id,
    name: profile.display_name,
    username: profile.username,
    role: profile.is_verified_student ? 'verified_student' : 'registered_user',
    departmentCode,
    departmentName,
    semester: profile.semester_label ?? 'Semester not set',
    allowMessages: 'Consent Requests Only',
    discoverability: 'University Students Only',
    isVerified: Boolean(profile.is_verified_student),
    discoverable: true,
    intro: profile.bio ?? '',
    interests: profile.interests ?? [],
    isNewAround: false,
    avatarUrl: profile.avatar_url ?? null,
    coverUrl: profile.cover_url ?? null,
    email: email ?? null,
    primaryUniversityId: profile.primary_university_id ?? null,
    departmentId: profile.department_id ?? null,
    isDemo: false,
  };
}

/** Overlay the student's saved privacy choices onto their identity. */
export function applyPreferences(user: AppUser, prefs?: PreferencesRow | null): AppUser {
  if (!prefs) return user;
  return {
    ...user,
    discoverability: discoverabilityFromDb(prefs.profile_visibility),
    allowMessages: messagingFromDb(prefs.allow_direct_messages),
  };
}

/**
 * Resolve the student a `/profile/<username>` link points at.
 *
 * A signed-in student's own profile is the account in the store; another
 * student's profile comes from the backend; the clearly-labelled demo
 * directory is the last fallback. Returns null when nothing matches, so the
 * page can wait for the session before deciding the profile does not exist.
 */
export function resolveProfileTarget<T extends { id: string; username: string }>(
  username: string,
  options: {
    self?: T | null;
    realPerson?: T | null;
    demoPeople?: readonly T[];
  } = {},
): T | null {
  const wanted = username.trim().toLowerCase();
  if (!wanted) return null;

  const matches = (candidate?: T | null) =>
    Boolean(candidate && candidate.username.trim().toLowerCase() === wanted);

  if (matches(options.self)) return options.self as T;
  if (matches(options.realPerson)) return options.realPerson as T;

  const fromDemo = (options.demoPeople ?? []).find((person) => matches(person));
  return fromDemo ?? null;
}

/** Preferences payload written back to public.user_preferences. */
export function preferencesToDb(input: {
  discoverability: Discoverability;
  allowMessages: MessagingPermission;
  showSemester: boolean;
  notifyEvents: boolean;
  notifyClubUpdates: boolean;
  notifyRoommateInquiries: boolean;
  showInHonours: boolean;
}): Required<PreferencesRow> & { updated_at: string } {
  return {
    profile_visibility: discoverabilityToDb(input.discoverability),
    allow_direct_messages: messagingToDb(input.allowMessages),
    show_semester: input.showSemester,
    notify_events: input.notifyEvents,
    notify_club_updates: input.notifyClubUpdates,
    notify_roommate_inquiries: input.notifyRoommateInquiries,
    show_in_honours: input.showInHonours,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns a human-readable error, or null when the username is acceptable. */
export function validateUsername(raw: string): string | null {
  const value = normalizeUsername(raw);
  if (value.length < 3) return 'Username must be at least 3 characters.';
  if (value.length > 30) return 'Username must be 30 characters or fewer.';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    return 'Use lowercase letters, numbers, dots, underscores or hyphens (start with a letter or number).';
  }
  if (value.endsWith('.') || value.endsWith('_') || value.endsWith('-')) {
    return 'Username cannot end with a dot, underscore or hyphen.';
  }
  return null;
}

export function validateDisplayName(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 2) return 'Please enter your name.';
  if (value.length > 60) return 'Name must be 60 characters or fewer.';
  return null;
}

export function validatePassword(raw: string): string | null {
  if (raw.length < 8) return 'Password must be at least 8 characters.';
  if (raw.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(raw) || !/[0-9]/.test(raw)) {
    return 'Use at least one letter and one number.';
  }
  return null;
}

export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  return null;
}

/** Turn Supabase auth errors into calm, honest copy. */
export function friendlyAuthError(message?: string | null): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (m.includes('email not confirmed')) return 'Please verify your email before signing in.';
  if (m.includes('user already registered')) return 'An account with this email already exists. Try signing in instead.';
  if (m.includes('password should be at least')) return 'Password is too short.';
  // The shared mailer caps how many confirmation emails a project may send.
  // That is our limit, not the student's — say so instead of "try again".
  if (m.includes('email rate limit') || m.includes('email_send_rate_limit')) {
    return 'Confirmation emails are temporarily rate-limited on this deployment. Please try again later, or use another email address.';
  }
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('email address') && m.includes('invalid')) return 'Enter a valid email address.';
  if (m.includes('provider is not enabled')) return 'That sign-in option is not enabled for this deployment.';
  return message || 'Something went wrong. Please try again.';
}
