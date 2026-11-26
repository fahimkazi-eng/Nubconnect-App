// ============================================================================
// NUBCONNECT — orbit.ts unit tests
// The signature Campus Orbit rules, as contracts:
//   • Make a Plan — 2–20 participants, honest lifecycle (§6.1)
//   • Campus Now — auto-expiring opt-in presence, never stale (§6.2)
//   • Temporary Circles — fade out unless members keep them (§6.4)
//   • Campus Honours — transparent points, opt-out honoured, minimum breadth,
//     deterministic ties, never an invented winner (§9)
//   • Membership verify tokens — stable and url-safe (§7.6)
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  PLAN_MIN_LIMIT,
  PLAN_MAX_LIMIT,
  planSpotsLeft,
  planStatus,
  canJoinPlan,
  planStartsIn,
  CAMPUS_NOW_TTL_MINS,
  campusNowExpiry,
  campusNowActive,
  campusNowRemainingMins,
  activeCampusNow,
  circleMinutesLeft,
  circleExpired,
  timeUntilLabel,
  honourPointsByPerson,
  topCampusContributor,
  membershipVerifyToken,
} from '@/lib/orbit';
import type {
  ActivityPlan,
  CampusHonourEntry,
  CampusNowStatus,
  Circle,
  HonourCategory,
} from '@/lib/types';

/* --- fixtures ------------------------------------------------------------ */

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0); // fixed "now" for every test
const iso = (ms: number) => new Date(ms).toISOString();
const mins = (m: number) => m * 60_000;

const basePlan = (patch: Partial<ActivityPlan> = {}): ActivityPlan => ({
  id: 'plan-x',
  title: 'Badminton at the gym',
  category: 'Sports',
  spot: 'Permanent Campus gym',
  startsAt: iso(NOW + mins(90)),
  durationMins: 60,
  participantLimit: 4,
  createdBy: 'p-amir',
  participants: ['p-amir', 'p-nayeem'],
  note: 'All levels welcome',
  createdAt: iso(NOW - mins(30)),
  isDemo: true,
  ...patch,
});

const baseStatus = (patch: Partial<CampusNowStatus> = {}): CampusNowStatus => ({
  id: 'cn-x',
  personId: 'p-amir',
  personName: 'Amir Hossain',
  activity: 'Studying',
  spot: 'Central Library, 3rd floor',
  note: '',
  postedAt: iso(NOW - mins(10)),
  expiresAt: iso(NOW + mins(110)),
  isDemo: true,
  ...patch,
});

const baseCircle = (patch: Partial<Circle> = {}): Circle => ({
  slug: 'c-photo-walk',
  name: 'Photo Walk Circle',
  category: 'Photography',
  description: 'Weekend photo walks',
  memberCount: 6,
  rules: ['Be kind'],
  isDemo: true,
  ...patch,
});

const honour = (
  id: string,
  personId: string,
  personName: string,
  category: HonourCategory,
  points: number,
  semester = 'Fall 2026',
): CampusHonourEntry => ({
  id,
  personId,
  personName,
  departmentCode: 'CSE',
  category,
  title: `Contribution ${id}`,
  detail: 'Verified contribution',
  points,
  semester,
  isDemo: true,
});

/* === Make a Plan ========================================================== */

describe('plan limits', () => {
  it('keeps real-life meetups small: 2–20 participants', () => {
    expect(PLAN_MIN_LIMIT).toBe(2);
    expect(PLAN_MAX_LIMIT).toBe(20);
  });
});

describe('planSpotsLeft', () => {
  it('counts remaining seats', () => {
    expect(planSpotsLeft(basePlan())).toBe(2); // 4 limit − 2 in
  });

  it('never reports negative seats', () => {
    expect(planSpotsLeft(basePlan({ participants: ['a', 'b', 'c', 'd', 'e'] }))).toBe(0);
  });
});

describe('planStatus', () => {
  it('is full at the participant limit', () => {
    expect(planStatus(basePlan({ participants: ['a', 'b', 'c', 'd'] }), NOW)).toBe('full');
  });

  it('is past once the plan has run its course', () => {
    const plan = basePlan({ startsAt: iso(NOW - mins(120)), durationMins: 60 });
    expect(planStatus(plan, NOW)).toBe('past');
  });

  it('is soon once the start time arrives (locked, not joinable)', () => {
    const plan = basePlan({ startsAt: iso(NOW - mins(5)) }); // within the 60m duration
    expect(planStatus(plan, NOW)).toBe('soon');
  });

  it('is open while seats remain and the start is in the future', () => {
    expect(planStatus(basePlan(), NOW)).toBe('open');
  });

  it('treats a full plan as full even after it starts', () => {
    const plan = basePlan({ participants: ['a', 'b', 'c', 'd'], startsAt: iso(NOW - mins(120)) });
    expect(planStatus(plan, NOW)).toBe('full');
  });
});

describe('canJoinPlan', () => {
  it('lets a new person join an open plan', () => {
    expect(canJoinPlan(basePlan(), 'p-sumi', NOW)).toEqual({ ok: true });
  });

  it('refuses someone already in the plan', () => {
    expect(canJoinPlan(basePlan(), 'p-nayeem', NOW)).toEqual({ ok: false, reason: 'already-in' });
  });

  it('refuses when the plan is full', () => {
    const plan = basePlan({ participants: ['a', 'b', 'c', 'd'] });
    expect(canJoinPlan(plan, 'p-sumi', NOW)).toEqual({ ok: false, reason: 'full' });
  });

  it('refuses after the plan is over', () => {
    const plan = basePlan({ startsAt: iso(NOW - mins(120)), durationMins: 60 });
    expect(canJoinPlan(plan, 'p-sumi', NOW)).toEqual({ ok: false, reason: 'past' });
  });

  it('refuses once the plan has started', () => {
    const plan = basePlan({ startsAt: iso(NOW - mins(5)) });
    expect(canJoinPlan(plan, 'p-sumi', NOW)).toEqual({ ok: false, reason: 'started' });
  });
});

describe('planStartsIn', () => {
  it('says started for the past', () => {
    expect(planStartsIn(iso(NOW - mins(5)), NOW)).toBe('started');
    expect(planStartsIn(iso(NOW), NOW)).toBe('started');
  });

  it('combines hours and minutes', () => {
    expect(planStartsIn(iso(NOW + mins(125)), NOW)).toBe('in 2h 5m');
  });

  it('drops the minutes when there are none', () => {
    expect(planStartsIn(iso(NOW + mins(180)), NOW)).toBe('in 3h');
  });

  it('uses minutes alone under an hour', () => {
    expect(planStartsIn(iso(NOW + mins(45)), NOW)).toBe('in 45m');
  });
});

/* === Campus Now =========================================================== */

describe('CAMPUS_NOW_TTL_MINS', () => {
  it('expires statuses after two hours', () => {
    expect(CAMPUS_NOW_TTL_MINS).toBe(120);
  });
});

describe('campusNowExpiry', () => {
  it('adds the default 2h TTL to the posted time', () => {
    expect(campusNowExpiry(iso(NOW))).toBe(iso(NOW + mins(120)));
  });

  it('supports a custom TTL', () => {
    expect(campusNowExpiry(iso(NOW), 30)).toBe(iso(NOW + mins(30)));
  });

  it('accepts a numeric timestamp too', () => {
    expect(campusNowExpiry(NOW)).toBe(iso(NOW + mins(120)));
  });
});

describe('campusNowActive', () => {
  it('is active before expiry', () => {
    expect(campusNowActive(baseStatus(), NOW)).toBe(true);
  });

  it('is inactive at and after expiry', () => {
    expect(campusNowActive(baseStatus({ expiresAt: iso(NOW) }), NOW)).toBe(false);
    expect(campusNowActive(baseStatus({ expiresAt: iso(NOW - mins(1)) }), NOW)).toBe(false);
  });

  it('fails closed on an unparseable expiry', () => {
    expect(campusNowActive(baseStatus({ expiresAt: 'not-a-date' }), NOW)).toBe(false);
  });
});

describe('campusNowRemainingMins', () => {
  it('rounds the remaining minutes', () => {
    expect(campusNowRemainingMins(baseStatus({ expiresAt: iso(NOW + mins(100)) }), NOW)).toBe(100);
    expect(campusNowRemainingMins(baseStatus({ expiresAt: iso(NOW + mins(90.6)) }), NOW)).toBe(91);
  });

  it('never reports negative time left', () => {
    expect(campusNowRemainingMins(baseStatus({ expiresAt: iso(NOW - mins(30)) }), NOW)).toBe(0);
  });
});

describe('activeCampusNow', () => {
  it('keeps only live statuses', () => {
    const statuses = [
      baseStatus({ id: 'cn-1', expiresAt: iso(NOW + mins(30)) }),
      baseStatus({ id: 'cn-2', expiresAt: iso(NOW - mins(1)) }),
      baseStatus({ id: 'cn-3', expiresAt: iso(NOW + mins(119)) }),
    ];
    expect(activeCampusNow(statuses, NOW).map((s) => s.id)).toEqual(['cn-1', 'cn-3']);
  });
});

/* === Temporary Circles ===================================================== */

describe('circleMinutesLeft', () => {
  it('returns null for permanent circles', () => {
    expect(circleMinutesLeft(baseCircle(), NOW)).toBeNull();
  });

  it('returns null for a temporary circle without an expiry', () => {
    expect(circleMinutesLeft(baseCircle({ temporary: true }), NOW)).toBeNull();
  });

  it('counts down for a live temporary circle', () => {
    const circle = baseCircle({ temporary: true, expiresAt: iso(NOW + mins(75)) });
    expect(circleMinutesLeft(circle, NOW)).toBe(75);
  });

  it('floors at zero once expired', () => {
    const circle = baseCircle({ temporary: true, expiresAt: iso(NOW - mins(10)) });
    expect(circleMinutesLeft(circle, NOW)).toBe(0);
  });
});

describe('circleExpired', () => {
  it('never expires a permanent circle', () => {
    expect(circleExpired(baseCircle(), NOW)).toBe(false);
  });

  it('expires a temporary circle past its time', () => {
    const circle = baseCircle({ temporary: true, expiresAt: iso(NOW - mins(1)) });
    expect(circleExpired(circle, NOW)).toBe(true);
  });

  it('keeps a live temporary circle', () => {
    const circle = baseCircle({ temporary: true, expiresAt: iso(NOW + mins(1)) });
    expect(circleExpired(circle, NOW)).toBe(false);
  });
});

describe('timeUntilLabel', () => {
  it('is empty for permanent things', () => {
    expect(timeUntilLabel(null)).toBe('');
  });

  it('says expired at zero or below', () => {
    expect(timeUntilLabel(0)).toBe('expired');
    expect(timeUntilLabel(-5)).toBe('expired');
  });

  it('uses minutes alone under an hour', () => {
    expect(timeUntilLabel(45)).toBe('45m left');
  });

  it('combines hours and minutes under a day', () => {
    expect(timeUntilLabel(320)).toBe('5h 20m left');
  });

  it('combines days and hours beyond a day', () => {
    expect(timeUntilLabel(3060)).toBe('2d 3h left');
  });
});

/* === Campus Honours ======================================================== */

describe('honourPointsByPerson', () => {
  it('sums points and tracks distinct categories per person', () => {
    const entries = [
      honour('h1', 'p-amir', 'Amir Hossain', 'Mentoring', 10),
      honour('h2', 'p-amir', 'Amir Hossain', 'Organizing', 15),
      honour('h3', 'p-amir', 'Amir Hossain', 'Organizing', 5), // same category twice
      honour('h4', 'p-sumi', 'Sumaiya Islam', 'Volunteering', 20),
    ];
    const by = honourPointsByPerson(entries);
    expect(by.get('p-amir')?.points).toBe(30);
    expect(by.get('p-amir')?.categories.size).toBe(2);
    expect(by.get('p-sumi')?.points).toBe(20);
  });

  it('filters to a semester when asked', () => {
    const entries = [
      honour('h1', 'p-amir', 'Amir Hossain', 'Mentoring', 10, 'Fall 2026'),
      honour('h2', 'p-amir', 'Amir Hossain', 'Mentoring', 40, 'Summer 2026'),
    ];
    expect(honourPointsByPerson(entries, { semester: 'Fall 2026' }).get('p-amir')?.points).toBe(10);
    expect(honourPointsByPerson(entries, { semester: 'Summer 2026' }).get('p-amir')?.points).toBe(40);
  });
});

describe('topCampusContributor', () => {
  const AMIR = [
    honour('a1', 'p-amir', 'Amir Hossain', 'Mentoring', 10),
    honour('a2', 'p-amir', 'Amir Hossain', 'Organizing', 10),
    honour('a3', 'p-amir', 'Amir Hossain', 'Knowledge Sharing', 10),
  ];
  const SUMI = [
    honour('s1', 'p-sumi', 'Sumaiya Islam', 'Volunteering', 5),
    honour('s2', 'p-sumi', 'Sumaiya Islam', 'Community Help', 5),
    honour('s3', 'p-sumi', 'Sumaiya Islam', 'Creative Contribution', 5),
  ];

  it('picks the most verified contribution points', () => {
    const top = topCampusContributor([...SUMI, ...AMIR]);
    expect(top?.personId).toBe('p-amir');
    expect(top?.points).toBe(30);
  });

  it('honours every opt-out — the runner-up becomes the top, never exposed', () => {
    const top = topCampusContributor([...SUMI, ...AMIR], { optedOut: ['p-amir'] });
    expect(top?.personId).toBe('p-sumi');
  });

  it('requires breadth across at least 3 distinct categories', () => {
    // Rafi has MORE points (60) but only 2 categories — deep, not broad.
    const RAFI = [
      honour('r1', 'p-rafi', 'Rafi Ahmed', 'Mentoring', 30),
      honour('r2', 'p-rafi', 'Rafi Ahmed', 'Organizing', 30),
    ];
    const top = topCampusContributor([...RAFI, ...SUMI]);
    expect(top?.personId).toBe('p-sumi');
  });

  it('never invents a winner when nobody qualifies', () => {
    expect(topCampusContributor([])).toBeNull();
    // A single person with a single category does not qualify either.
    expect(topCampusContributor([honour('x1', 'p-amir', 'Amir Hossain', 'Mentoring', 10)])).toBeNull();
  });

  it('breaks ties deterministically by person id, regardless of entry order', () => {
    // Both qualify with equal points; 'p-amir' sorts before 'p-rafi'.
    const RAFI = [
      honour('r1', 'p-rafi', 'Rafi Ahmed', 'Mentoring', 10),
      honour('r2', 'p-rafi', 'Rafi Ahmed', 'Organizing', 10),
      honour('r3', 'p-rafi', 'Rafi Ahmed', 'Volunteering', 10),
    ];
    const amirFirst = topCampusContributor([...AMIR, ...RAFI]);
    const rafiFirst = topCampusContributor([...RAFI, ...AMIR]);
    expect(amirFirst?.personId).toBe('p-amir');
    expect(rafiFirst?.personId).toBe('p-amir');
  });

  it('respects the semester filter', () => {
    const fall = AMIR.map((e) => ({ ...e, semester: 'Fall 2026' }));
    const summer = SUMI.map((e) => ({ ...e, semester: 'Summer 2026' }));
    expect(topCampusContributor([...fall, ...summer], { semester: 'Summer 2026' })?.personId).toBe('p-sumi');
  });
});

/* === Membership card verify tokens ========================================= */

describe('membershipVerifyToken', () => {
  it('is deterministic for the same club + person', () => {
    expect(membershipVerifyToken('nubcc', 'usr-tasnim')).toBe(membershipVerifyToken('nubcc', 'usr-tasnim'));
  });

  it('differs per club and per person', () => {
    expect(membershipVerifyToken('nubcc', 'usr-tasnim')).not.toBe(membershipVerifyToken('film-photo', 'usr-tasnim'));
    expect(membershipVerifyToken('nubcc', 'usr-tasnim')).not.toBe(membershipVerifyToken('nubcc', 'usr-rakib'));
  });

  it('is url-safe (it is embedded in /verify/{token} paths)', () => {
    const token = membershipVerifyToken('film-photo', 'usr-tasnim');
    expect(token).toMatch(/^nub-[a-z0-9]+$/);
  });
});
