// ============================================================================
// NUBCONNECT — profile link resolution unit tests
//
// `/profile/<username>` can point at three different students: the account
// that is signed in, another student's real backend profile, or the
// clearly-labelled demo directory. These tests guard the lookup that decides
// which one it is — and, just as importantly, that it returns "not found"
// instead of guessing while the session is still loading.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { resolveProfileTarget } from '@/lib/auth';
import type { AppUser } from '@/lib/types';

const person = (id: string, username: string): AppUser => ({
  id,
  name: username,
  username,
  role: 'registered_user',
  departmentCode: 'CSE',
  departmentName: 'Computer Science & Engineering',
  semester: '7th Semester',
  allowMessages: 'Consent Requests Only',
  discoverability: 'University Students Only',
  isVerified: false,
  discoverable: true,
  intro: '',
  interests: [],
  isNewAround: false,
  avatarUrl: null,
  coverUrl: null,
  email: null,
  isDemo: false,
});

const SELF = person('self-id', 'qa.student');
const REAL = person('real-id', 'rakibul.cse');
const DEMO = [person('demo-1', 'arif'), person('demo-2', 'nusrat.bba')];

describe('resolveProfileTarget', () => {
  it('resolves the signed-in student from their own username', () => {
    expect(resolveProfileTarget('qa.student', { self: SELF, demoPeople: DEMO })).toBe(SELF);
  });

  it('resolves another student from the backend profile', () => {
    expect(resolveProfileTarget('rakibul.cse', { self: SELF, realPerson: REAL, demoPeople: DEMO })).toBe(REAL);
  });

  it('falls back to the demo directory', () => {
    expect(resolveProfileTarget('arif', { self: SELF, realPerson: REAL, demoPeople: DEMO })).toBe(DEMO[0]);
  });

  it('matches usernames case-insensitively', () => {
    expect(resolveProfileTarget('QA.STUDENT', { self: SELF })).toBe(SELF);
    expect(resolveProfileTarget('Rakibul.CSE', { realPerson: REAL })).toBe(REAL);
  });

  it('prefers the signed-in student over the demo directory', () => {
    const demoSelf = person('demo-self', 'qa.student');
    expect(resolveProfileTarget('qa.student', { self: demoSelf, demoPeople: [demoSelf] })).toBe(demoSelf);
  });

  it('returns null when nothing matches, so the page can wait for the session', () => {
    expect(resolveProfileTarget('nobody.here', { self: SELF, demoPeople: DEMO })).toBeNull();
  });

  it('returns null for an empty username', () => {
    expect(resolveProfileTarget('', { self: SELF, demoPeople: DEMO })).toBeNull();
    expect(resolveProfileTarget('   ', { self: SELF })).toBeNull();
  });

  it('returns null when there is no session and no match', () => {
    expect(resolveProfileTarget('qa.student', {})).toBeNull();
  });
});
