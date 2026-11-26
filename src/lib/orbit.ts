// ============================================================================
// NUBCONNECT — CAMPUS ORBIT logic (pure functions, unit-tested).
//
// The signature features share one rule: nothing here trusts the client
// clock for security, everything is opt-in, and everything expires honestly.
//   • Make a Plan — real-life meetups with participant limits (§6.1)
//   • Campus Now — auto-expiring, opt-in presence, no tracking (§6.2)
//   • Temporary Circles — fade out unless members keep them (§6.4)
//   • Campus Honours — transparent contribution points, opt-out, no
//     popularity rankings (§9)
// ============================================================================
import type {
  ActivityPlan,
  CampusHonourEntry,
  CampusNowStatus,
  Circle,
  HonourCategory,
} from './types';
import { hashSeed } from './format';

/* === Make a Plan =========================================================== */

export const PLAN_MIN_LIMIT = 2;
export const PLAN_MAX_LIMIT = 20;

export type PlanStatus = 'open' | 'full' | 'soon' | 'past';

export function planSpotsLeft(plan: ActivityPlan): number {
  return Math.max(0, plan.participantLimit - plan.participants.length);
}

/** A plan's lifecycle: open (joinable) → full → soon (locked at start) → past. */
export function planStatus(plan: ActivityPlan, now: number = Date.now()): PlanStatus {
  if (plan.participants.length >= plan.participantLimit) return 'full';
  if (new Date(plan.startsAt).getTime() + plan.durationMins * 60_000 < now) return 'past';
  if (new Date(plan.startsAt).getTime() <= now) return 'soon';
  return 'open';
}

export type JoinPlanResult = { ok: true } | { ok: false; reason: 'full' | 'past' | 'started' | 'already-in' };

export function canJoinPlan(plan: ActivityPlan, personId: string, now: number = Date.now()): JoinPlanResult {
  if (plan.participants.includes(personId)) return { ok: false, reason: 'already-in' };
  const status = planStatus(plan, now);
  if (status === 'full') return { ok: false, reason: 'full' };
  if (status === 'past') return { ok: false, reason: 'past' };
  if (status === 'soon') return { ok: false, reason: 'started' };
  return { ok: true };
}

/** Friendly "starts in" copy: 2h 5m from now. */
export function planStartsIn(startsAt: string, now: number = Date.now()): string {
  const diffMins = Math.round((new Date(startsAt).getTime() - now) / 60_000);
  if (diffMins <= 0) return 'started';
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  if (h > 0 && m > 0) return `in ${h}h ${m}m`;
  if (h > 0) return `in ${h}h`;
  return `in ${m}m`;
}

/* === Campus Now ============================================================ */

/** Campus Now statuses live for two hours, then disappear on their own. */
export const CAMPUS_NOW_TTL_MINS = 120;

export function campusNowExpiry(postedAt: string | number, ttlMins: number = CAMPUS_NOW_TTL_MINS): string {
  const t = typeof postedAt === 'number' ? postedAt : new Date(postedAt).getTime();
  return new Date(t + ttlMins * 60_000).toISOString();
}

export function campusNowActive(status: CampusNowStatus, now: number = Date.now()): boolean {
  const expires = new Date(status.expiresAt).getTime();
  return !Number.isNaN(expires) && expires > now;
}

export function campusNowRemainingMins(status: CampusNowStatus, now: number = Date.now()): number {
  return Math.max(0, Math.round((new Date(status.expiresAt).getTime() - now) / 60_000));
}

export function activeCampusNow(statuses: CampusNowStatus[], now: number = Date.now()): CampusNowStatus[] {
  return statuses.filter((s) => campusNowActive(s, now));
}

/* === Temporary Circles ====================================================== */

export function circleMinutesLeft(circle: Circle, now: number = Date.now()): number | null {
  if (!circle.temporary || !circle.expiresAt) return null;
  return Math.max(0, Math.round((new Date(circle.expiresAt).getTime() - now) / 60_000));
}

export function circleExpired(circle: Circle, now: number = Date.now()): boolean {
  const left = circleMinutesLeft(circle, now);
  return left != null && left <= 0;
}

export function timeUntilLabel(minutes: number | null): string {
  if (minutes == null) return '';
  if (minutes <= 0) return 'expired';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  return `${minutes}m left`;
}

/* === Campus Honours ======================================================== */

export const HONOUR_CATEGORIES: readonly HonourCategory[] = [
  'Mentoring',
  'Organizing',
  'Community Help',
  'Knowledge Sharing',
  'Creative Contribution',
  'Volunteering',
];

export const HONOUR_CATEGORY_BLURBS: Record<HonourCategory, string> = {
  Mentoring: 'Helping juniors find their feet — courses, labs, campus life',
  Organizing: 'Running clubs, events and teams that bring people together',
  'Community Help': 'Showing up for fellow students when it matters',
  'Knowledge Sharing': 'Notes, tutorials and study sessions open to everyone',
  'Creative Contribution': 'Design, photography, writing and campus culture',
  Volunteering: 'Drives, campaigns and quiet acts of service',
};

/** Sum contribution points per person. The ONLY ranking input in the app. */
export function honourPointsByPerson(
  entries: CampusHonourEntry[],
  opts?: { semester?: string },
): Map<string, { name: string; department: string; points: number; categories: Set<HonourCategory> }> {
  const by = new Map<string, { name: string; department: string; points: number; categories: Set<HonourCategory> }>();
  for (const e of entries) {
    if (opts?.semester && e.semester !== opts.semester) continue;
    const cur = by.get(e.personId) ?? { name: e.personName, department: e.departmentCode, points: 0, categories: new Set<HonourCategory>() };
    cur.points += e.points;
    cur.categories.add(e.category);
    by.set(e.personId, cur);
  }
  return by;
}

export interface TopContributor {
  personId: string;
  personName: string;
  departmentCode: string;
  points: number;
}

/** Top Campus Contributor (§9): transparent criteria — most verified
 *  contribution points in the current semester, minimum 3 distinct categories,
 *  honouring every opt-out. Returns null when nobody qualifies (never invents
 *  a winner). Ties are broken deterministically by person id. */
export function topCampusContributor(
  entries: CampusHonourEntry[],
  opts?: { semester?: string; optedOut?: string[]; minCategories?: number },
): TopContributor | null {
  const optedOut = new Set(opts?.optedOut ?? []);
  const minCategories = opts?.minCategories ?? 3;
  const by = honourPointsByPerson(entries, { semester: opts?.semester });
  let best: TopContributor | null = null;
  for (const [personId, { name, department, points, categories }] of by) {
    if (optedOut.has(personId)) continue;
    if (categories.size < minCategories) continue;
    if (!best || points > best.points || (points === best.points && personId < best.personId)) {
      best = { personId, personName: name, departmentCode: department, points };
    }
  }
  return best;
}

/* === Membership card verify tokens ========================================= */

/** Deterministic demo token — in production this is a server-issued random
 *  secret; here it only needs to be stable and url-safe. */
export function membershipVerifyToken(clubSlug: string, personId: string): string {
  return `nub-${hashSeed(`${clubSlug}:${personId}`).toString(36)}`;
}
