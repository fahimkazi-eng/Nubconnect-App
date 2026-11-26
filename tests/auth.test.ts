// ============================================================================
// NUBCONNECT — auth.ts unit tests (Phase 2)
// Account mapping, privacy round-trips and form validation. These guard the
// boundary between Supabase rows and the identity the UI renders.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  applyPreferences,
  discoverabilityFromDb,
  discoverabilityToDb,
  friendlyAuthError,
  mapProfileToAppUser,
  messagingFromDb,
  messagingToDb,
  normalizeUsername,
  preferencesToDb,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
  type ProfileRow,
} from '@/lib/auth';

const PROFILE: ProfileRow = {
  id: 'user-1',
  username: 'tasnim.cse',
  display_name: 'Tasnim Rahman',
  avatar_url: 'https://example.test/avatar.jpg',
  cover_url: null,
  primary_university_id: 'uni-nub',
  department_id: 'dept-cse',
  semester_label: '7th Semester',
  bio: 'Campus photographer.',
  interests: ['Machine Learning', 'UI Design'],
  is_verified_student: false,
  is_suspended: false,
  departments: { code: 'CSE', name: 'Computer Science & Engineering' },
};

describe('profile mapping', () => {
  it('maps a profile row into the app identity', () => {
    const user = mapProfileToAppUser(PROFILE, 'tasnim@example.com');
    expect(user.id).toBe('user-1');
    expect(user.name).toBe('Tasnim Rahman');
    expect(user.username).toBe('tasnim.cse');
    expect(user.departmentCode).toBe('CSE');
    expect(user.departmentName).toBe('Computer Science & Engineering');
    expect(user.semester).toBe('7th Semester');
    expect(user.isVerified).toBe(false);
    expect(user.role).toBe('registered_user');
    expect(user.email).toBe('tasnim@example.com');
    expect(user.isDemo).toBe(false);
    expect(user.interests).toEqual(['Machine Learning', 'UI Design']);
  });

  it('treats a verified profile as verified_student', () => {
    const user = mapProfileToAppUser({ ...PROFILE, is_verified_student: true });
    expect(user.isVerified).toBe(true);
    expect(user.role).toBe('verified_student');
  });

  it('never fabricates a department when the join is missing', () => {
    const user = mapProfileToAppUser({ ...PROFILE, departments: null });
    expect(user.departmentCode).toBe('NUB');
    expect(user.departmentName).toBe('Northern University Bangladesh');
    expect(user.semester).toBe('7th Semester');
  });

  it('falls back to an honest empty semester label', () => {
    const user = mapProfileToAppUser({ ...PROFILE, semester_label: null });
    expect(user.semester).toBe('Semester not set');
  });
});

describe('privacy mapping', () => {
  it('round-trips discoverability', () => {
    expect(discoverabilityFromDb('public')).toBe('Public');
    expect(discoverabilityFromDb('verified_only')).toBe('Verified Students Only');
    expect(discoverabilityFromDb('university_only')).toBe('University Students Only');
    expect(discoverabilityFromDb(null)).toBe('University Students Only');

    expect(discoverabilityToDb('Public')).toBe('public');
    expect(discoverabilityToDb('Verified Students Only')).toBe('verified_only');
    expect(discoverabilityToDb('University Students Only')).toBe('university_only');
  });

  it('round-trips messaging permissions', () => {
    expect(messagingFromDb('anyone')).toBe('Anyone');
    expect(messagingFromDb('verified_students')).toBe('University Students Only');
    expect(messagingFromDb('requests_only')).toBe('Consent Requests Only');
    expect(messagingFromDb('none')).toBe('Consent Requests Only');

    expect(messagingToDb('Anyone')).toBe('anyone');
    expect(messagingToDb('University Students Only')).toBe('verified_students');
    expect(messagingToDb('Consent Requests Only')).toBe('requests_only');
  });

  it('overlays saved preferences onto the identity', () => {
    const user = applyPreferences(mapProfileToAppUser(PROFILE), {
      profile_visibility: 'public',
      allow_direct_messages: 'anyone',
    });
    expect(user.discoverability).toBe('Public');
    expect(user.allowMessages).toBe('Anyone');
  });

  it('builds a complete preferences payload for the database', () => {
    const payload = preferencesToDb({
      discoverability: 'Verified Students Only',
      allowMessages: 'Consent Requests Only',
      showSemester: false,
      notifyEvents: true,
      notifyClubUpdates: false,
      notifyRoommateInquiries: true,
      showInHonours: false,
    });
    expect(payload.profile_visibility).toBe('verified_only');
    expect(payload.allow_direct_messages).toBe('requests_only');
    expect(payload.show_semester).toBe(false);
    expect(payload.notify_events).toBe(true);
    expect(payload.notify_club_updates).toBe(false);
    expect(payload.notify_roommate_inquiries).toBe(true);
    expect(payload.show_in_honours).toBe(false);
    expect(typeof payload.updated_at).toBe('string');
  });
});

describe('validation', () => {
  it('normalizes usernames', () => {
    expect(normalizeUsername('  Tasnim.CSE ')).toBe('tasnim.cse');
  });

  it('accepts reasonable usernames', () => {
    expect(validateUsername('tasnim.cse')).toBeNull();
    expect(validateUsername('rakib_2026')).toBeNull();
    expect(validateUsername('nusrat-bba')).toBeNull();
  });

  it('rejects invalid usernames', () => {
    expect(validateUsername('ab')).toBeTruthy();
    expect(validateUsername('has space')).toBeTruthy();
    expect(validateUsername('-starts-with-hyphen')).toBeTruthy();
    expect(validateUsername('ends-with-dot.')).toBeTruthy();
    expect(validateUsername('a'.repeat(31))).toBeTruthy();
  });

  it('validates display names', () => {
    expect(validateDisplayName('Tasnim Rahman')).toBeNull();
    expect(validateDisplayName(' ')).toBeTruthy();
    expect(validateDisplayName('x'.repeat(61))).toBeTruthy();
  });

  it('requires a letter and a number in passwords', () => {
    expect(validatePassword('campus2026')).toBeNull();
    expect(validatePassword('short1')).toBeTruthy();
    expect(validatePassword('onlyletters')).toBeTruthy();
    expect(validatePassword('12345678')).toBeTruthy();
    expect(validatePassword('a'.repeat(73) + '1')).toBeTruthy();
  });

  it('validates emails', () => {
    expect(validateEmail('student@nub.ac.bd')).toBeNull();
    expect(validateEmail('not-an-email')).toBeTruthy();
    expect(validateEmail('missing@domain')).toBeTruthy();
  });
});

describe('friendly auth errors', () => {
  it('turns common Supabase messages into calm copy', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Email or password is incorrect.');
    expect(friendlyAuthError('Email not confirmed')).toContain('verify your email');
    expect(friendlyAuthError('User already registered')).toContain('already exists');
    expect(friendlyAuthError('Rate limit exceeded')).toContain('Too many attempts');
  });

  it('keeps an unknown message rather than hiding it', () => {
    expect(friendlyAuthError('Something specific happened')).toBe('Something specific happened');
    expect(friendlyAuthError(null)).toBe('Something went wrong. Please try again.');
  });

  it('names the mailer limit instead of blaming the student', () => {
    expect(friendlyAuthError('email rate limit exceeded')).toContain('rate-limited');
    expect(friendlyAuthError('over_email_send_rate_limit')).toContain('rate-limited');
    // A generic rate limit is still a "too many attempts" message.
    expect(friendlyAuthError('Rate limit exceeded')).toContain('Too many attempts');
  });
});
