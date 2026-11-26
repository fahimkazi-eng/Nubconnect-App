'use client';

// ============================================================================
// CAMPUS ORBIT — Find Your Circle, in four areas (§6):
//   People    : Discover People — Campus Now strip + Introductions + grid
//   Clubs     : Club Universe — the verified club directory
//   Circles   : Interest Circles — permanent, Temporary (§6.4), study groups
//   Activities: Campus Activities — Make a Plan (§6.1) + campus events
//
// Follow (people), Join (circles/clubs/groups) and Message stay distinct
// actions, per product decision §2.3.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  ChevronRight,
  Clock,
  Handshake,
  MapPin,
  MessageCircle,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
  Timer,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { DEMO_CIRCLES, DEMO_PEOPLE } from '@/lib/demo/dataset';
import { REAL_EVENTS } from '@/lib/nubEvents';
import { useApp } from '@/lib/store';
import { coverScene } from '@/lib/photos';
import AvailabilityComposer from '@/components/pulse/AvailabilityComposer';
import { remainingMinutes } from '@/lib/pulse';
import { Avatar, Chip, DemoTag, Modal, Tabs, VerifiedBadge } from '@/components/ui/kit';
import { pluralize } from '@/lib/format';
import { canMessage } from '@/lib/privacy';
import {
  PLAN_MAX_LIMIT,
  PLAN_MIN_LIMIT,
  canJoinPlan,
  planSpotsLeft,
  planStartsIn,
  planStatus,
  timeUntilLabel,
  circleMinutesLeft,
} from '@/lib/orbit';
import type { ActivityPlan, PlanCategory } from '@/lib/types';

const PEOPLE_FILTERS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'department', label: 'Same Department' },
  { key: 'interests', label: 'Shared Interests' },
  { key: 'circles', label: 'People in Your Circles' },
  { key: 'new', label: 'New Around Campus' },
] as const;

const PLAN_CATEGORIES: PlanCategory[] = ['Study', 'Sports', 'Food', 'Event', 'Errand'];

const TAB_AREAS = ['people', 'clubs', 'circles', 'activities'] as const;
type CircleArea = (typeof TAB_AREAS)[number];

/** Re-render once a minute so the countdowns stay honest without a ticker UI. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => (x + 1) % 1_000_000), 60_000);
    return () => clearInterval(t);
  }, []);
}

/** datetime-local value for a Date, in the viewer's local timezone. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  'touch-target w-full rounded-xl border border-campus-border bg-campus-card px-3 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';

/* === Campus Pulse (§6.2) =================================================== */
/* Availability is shared with Home's "Who's on Campus?" card and /pulse —
   one flow, one set of statuses (src/components/pulse/AvailabilityComposer). */

function CampusNowStrip() {
  const { availability, pulseLoading, platformFlags } = useApp();
  const [open, setOpen] = useState(false);
  useMinuteTick();

  const loading = pulseLoading && availability.length === 0;
  const mine = availability.find((a) => a.isMine) ?? null;
  const others = availability.filter((a) => !a.isMine);

  if (!platformFlags.campus_pulse) return null;

  return (
    <section className="card p-4" aria-labelledby="campus-now-h">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h2 id="campus-now-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
            <Timer size={15} className="text-violet-ink" /> Campus Pulse
          </h2>
          <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            Who&apos;s around right now — opted in, expires on its own
          </p>
        </div>
        {!mine && (
          <button
            onClick={() => setOpen(true)}
            className="touch-target flex shrink-0 items-center gap-1 rounded-xl bg-violet px-3 py-1.5 text-[11px] font-bold text-plum"
          >
            <Plus size={12} /> Post status
          </button>
        )}
      </div>

      {mine && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-violet-soft p-2.5 dark:bg-violet-dark-soft">
          <p className="min-w-0 text-xs font-bold">
            Your status is live — {mine.status.emoji} {mine.status.label}
            {mine.onCampus ? ' · on campus' : ''}
            {mine.openToConnect && ' · Open to Connect'}
            <span className="block text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              {remainingMinutes(mine.expiresAt)} min left · update or clear it anytime
            </span>
          </p>
          <button
            onClick={() => setOpen(true)}
            className="touch-target shrink-0 rounded-lg bg-campus-card px-2.5 py-1.5 text-[10px] font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
          >
            Update
          </button>
        </div>
      )}

      {others.length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {others.map((s) => (
            <div key={s.id} className="w-56 shrink-0 rounded-2xl bg-campus-bg p-3 dark:bg-campus-dark-elev">
              <div className="flex items-center gap-2">
                <Avatar seed={s.userId} name={s.name} size={32} src={s.avatarUrl} />
                <p className="min-w-0 flex-1 truncate text-xs font-bold">{s.name}</p>
              </div>
              <p className="mt-1.5 text-[11px] font-bold text-violet-ink dark:text-violet">
                {s.status.emoji} {s.status.label}
                {s.spot ? ` · ${s.spot}` : ''}
              </p>
              {s.openToConnect && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-aqua-soft px-2 py-0.5 text-[10px] font-bold text-aqua-ink">
                  <Handshake size={10} /> Open to Connect
                </span>
              )}
              {s.message && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
                  {s.message}
                </p>
              )}
              <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                <Clock size={10} /> {remainingMinutes(s.expiresAt)} min left
              </p>
            </div>
          ))}
        </div>
      )}

      {!mine && others.length === 0 && (
        <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
          {loading
            ? 'Checking who is around…'
            : 'Nobody has shared right now — statuses are always opt-in.'}
        </p>
      )}

      <Link
        href="/pulse"
        className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-bold text-violet-ink hover:underline dark:text-violet"
      >
        Open Campus Pulse <ChevronRight size={11} />
      </Link>

      <AvailabilityComposer open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

/* === Campus Introductions (§6.3) =========================================== */

function IntroductionsSection() {
  const { introductions, respondIntroduction } = useApp();
  const visible = introductions.filter((i) => i.status === 'pending' || i.status === 'accepted');
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="intros-h">
      <h2 id="intros-h" className="mb-2 flex items-center gap-1.5 px-1 font-display text-sm font-bold">
        <Handshake size={15} className="text-violet-ink" /> Introductions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((intro) => {
          const person = DEMO_PEOPLE.find((p) => p.id === intro.personId);
          if (!person) return null;
          const accepted = intro.status === 'accepted';
          return (
            <div key={intro.id} className="card p-3.5">
              <div className="flex items-start gap-3">
                <Avatar seed={person.id} name={person.name} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${person.username}`} className="font-display text-sm font-bold hover:underline">
                    {person.name}
                  </Link>
                  <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    {person.departmentCode} • {intro.basis}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                {intro.reason}
              </p>
              {accepted ? (
                <p className="mt-2.5 rounded-xl bg-lime-soft px-3 py-2 text-[11px] font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
                  ✓ Connected — your chat is in Messages
                </p>
              ) : (
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => respondIntroduction(intro.id, 'accepted')}
                    className="touch-target flex-1 rounded-xl bg-violet py-2 text-xs font-bold text-plum shadow-violet-glow"
                  >
                    Introduce us
                  </button>
                  <button
                    onClick={() => respondIntroduction(intro.id, 'declined')}
                    className="touch-target flex-1 rounded-xl bg-campus-bg py-2 text-xs font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
                  >
                    Not now
                  </button>
                </div>
              )}
              <p className="mt-2 text-[10px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
                Both of you say yes before a chat opens. Declining is silent — they are never told.
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* === Make a Plan (§6.1) ===================================================== */

function PlanComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createPlan, pushToast } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlanCategory>('Study');
  const [spot, setSpot] = useState('');
  const [when, setWhen] = useState(() => toLocalInputValue(new Date(Date.now() + 2 * 3_600_000)));
  const [durationMins, setDurationMins] = useState(60);
  const [participantLimit, setParticipantLimit] = useState(5);
  const [note, setNote] = useState('');

  const submit = () => {
    const startsAtMs = new Date(when).getTime();
    if (!title.trim() || !spot.trim() || Number.isNaN(startsAtMs)) {
      pushToast('Add a title and a meeting spot first', 'warning');
      return;
    }
    if (startsAtMs <= Date.now()) {
      pushToast('Pick a time in the future', 'warning');
      return;
    }
    createPlan({
      title: title.trim(),
      category,
      spot: spot.trim(),
      startsAt: new Date(startsAtMs).toISOString(),
      durationMins,
      participantLimit: Math.min(PLAN_MAX_LIMIT, Math.max(PLAN_MIN_LIMIT, participantLimit)),
      note: note.trim(),
    });
    setTitle('');
    setSpot('');
    setNote('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Make a Plan">
      <p className="mb-3 text-[13px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        A real-life meetup with a purpose — everyone who joins gets the group chat.
      </p>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        What&apos;s the plan?
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. DBMS lab prep — query planner walkthrough"
        className={inputCls + " mb-3"}
      />

      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        Category
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PLAN_CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        Meeting spot (general campus area only)
      </label>
      <input
        value={spot}
        onChange={(e) => setSpot(e.target.value)}
        placeholder="e.g. CSE Lab 2, Permanent Campus"
        className={inputCls + " mb-3"}
      />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
            Starts
          </label>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
            Duration
          </label>
          <select
            value={durationMins}
            onChange={(e) => setDurationMins(Number(e.target.value))}
            className={inputCls}
          >
            {[30, 45, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        Participant limit ({PLAN_MIN_LIMIT}–{PLAN_MAX_LIMIT})
      </label>
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          aria-label="Fewer participants"
          onClick={() => setParticipantLimit((n) => Math.max(PLAN_MIN_LIMIT, n - 1))}
          className="touch-target flex h-9 w-9 items-center justify-center rounded-xl bg-campus-bg font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
        >
          −
        </button>
        <span className="font-display text-lg font-extrabold">{participantLimit}</span>
        <button
          type="button"
          aria-label="More participants"
          onClick={() => setParticipantLimit((n) => Math.min(PLAN_MAX_LIMIT, n + 1))}
          className="touch-target flex h-9 w-9 items-center justify-center rounded-xl bg-campus-bg font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
        >
          +
        </button>
        <span className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
          Real meetups stay small on purpose
        </span>
      </div>

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        Note (optional)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Anything others should bring or know"
        className={inputCls + " mb-4 resize-none"}
      />

      <button
        onClick={submit}
        className="touch-target w-full rounded-xl bg-violet py-3 text-sm font-bold text-plum shadow-violet-glow"
      >
        Create the plan
      </button>
    </Modal>
  );
}

function PlanCard({ plan }: { plan: ActivityPlan }) {
  const { joinPlan, leavePlan, planConversationId } = useApp();
  useMinuteTick();

  const inPlan = plan.participants.includes('me');
  const status = planStatus(plan);
  const spotsLeft = planSpotsLeft(plan);
  const joinable = canJoinPlan(plan, 'me');
  const chatId = inPlan ? planConversationId(plan.id) : null;
  const filledPct = Math.round((plan.participants.length / plan.participantLimit) * 100);

  const statusChip =
    status === 'open'
      ? { label: `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`, cls: 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime' }
      : status === 'full'
        ? { label: 'Full', cls: 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec' }
        : status === 'soon'
          ? { label: 'Starting', cls: 'bg-sunshine-soft text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' }
          : { label: 'Past', cls: 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec' };

  return (
    <div className="card flex flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-display text-[13px] font-bold leading-snug">{plan.title}</p>
        {plan.isDemo && <DemoTag compact />}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
        <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
          {plan.category}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={11} /> {plan.spot}
        </span>
        <span className="flex items-center gap-1">
          <CalendarClock size={11} /> {planStartsIn(plan.startsAt)} · {plan.durationMins}m
        </span>
      </div>
      {plan.note && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          {plan.note}
        </p>
      )}

      {/* Participants */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {plan.participants.slice(0, 5).map((pid) => {
            const person = pid === 'me' ? null : DEMO_PEOPLE.find((p) => p.id === pid);
            return (
              <span key={pid} className="rounded-full ring-2 ring-campus-card dark:ring-campus-dark-card">
                <Avatar seed={pid} name={person?.name ?? 'You'} size={22} />
              </span>
            );
          })}
        </div>
        <span className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          {plan.participants.length} of {plan.participantLimit} in
        </span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${statusChip.cls}`}>
          {statusChip.label}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-campus-bg dark:bg-campus-dark-elev">
        <div
          className={`h-full rounded-full ${status === 'full' ? 'bg-coral' : 'bg-violet'} transition-all`}
          style={{ width: `${filledPct}%` }}
          role="progressbar"
          aria-valuenow={plan.participants.length}
          aria-valuemin={0}
          aria-valuemax={plan.participantLimit}
          aria-label={`${plan.participants.length} of ${plan.participantLimit} participants`}
        />
      </div>

      {/* Actions */}
      <div className="mt-2.5 flex gap-2">
        {inPlan ? (
          <>
            {chatId && (
              <Link
                href={`/messages/${chatId}`}
                className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet py-2 text-xs font-bold text-plum"
              >
                <MessageSquare size={13} /> Group chat
              </Link>
            )}
            <button
              onClick={() => leavePlan(plan.id)}
              className="touch-target flex-1 rounded-xl bg-campus-bg py-2 text-xs font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
            >
              Leave
            </button>
          </>
        ) : joinable.ok ? (
          <button
            onClick={() => joinPlan(plan.id)}
            className="touch-target flex-1 rounded-xl bg-violet py-2 text-xs font-bold text-plum shadow-violet-glow"
          >
            Join the plan
          </button>
        ) : (
          <button
            disabled
            className="flex-1 cursor-not-allowed rounded-xl bg-campus-bg py-2 text-xs font-bold text-campus-text-sec opacity-60 ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
          >
            {joinable.reason === 'full' ? 'Plan is full' : joinable.reason === 'already-in' ? 'You are in' : 'Locked'}
          </button>
        )}
      </div>
    </div>
  );
}

function PlansSection() {
  const { plans } = useApp();
  const [open, setOpen] = useState(false);
  const live = plans.filter((p) => planStatus(p) !== 'past');
  const past = plans.filter((p) => planStatus(p) === 'past');

  return (
    <section aria-labelledby="plans-h">
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div>
          <h2 id="plans-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
            <CalendarClock size={15} className="text-violet-ink" /> Make a Plan
          </h2>
          <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            Real-life meetups with a purpose — join one or start your own
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="touch-target flex shrink-0 items-center gap-1 rounded-xl bg-violet px-3 py-1.5 text-[11px] font-bold text-plum"
        >
          <Plus size={12} /> New plan
        </button>
      </div>

      {live.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {live.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <details className="card mt-3 p-3.5">
          <summary className="cursor-pointer list-none font-display text-xs font-bold text-campus-text-sec dark:text-campus-dark-sec [&::-webkit-details-marker]:hidden">
            Past plans ({past.length})
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {past.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
          </div>
        </details>
      )}
      <PlanComposer open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

/* === Temporary Circles (§6.4) =============================================== */

function TemporaryCircleCard({ slug }: { slug: string }) {
  const { promotedCircles, promoteCircle, joinedCircles } = useApp();
  useMinuteTick();
  const circle = DEMO_CIRCLES.find((c) => c.slug === slug);
  // Temporary-circle promotion is demo-only: the real schema has no expiry
  // or promotion field to back that interaction.
  if (!circle || !circle.isDemo) return null;

  const promoted = promotedCircles.includes(slug);
  const joined = joinedCircles.includes(slug);
  const left = circleMinutesLeft(circle);
  const expired = left != null && left <= 0;

  return (
    <div className="card flex flex-col p-3.5 ring-1 ring-violet/25 dark:ring-violet/20">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/circles/${slug}`} className="min-w-0 flex-1 font-display text-[13px] font-bold hover:underline">
          {circle.name}
        </Link>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-sunshine-soft px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
          <Timer size={10} /> {promoted ? 'Made permanent' : expired ? 'Expired' : timeUntilLabel(left)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        {circle.description}
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
        <Users size={11} /> {pluralize(circle.memberCount, 'member')} · {circle.category}
      </p>
      <div className="mt-2.5 flex gap-2">
        {promoted ? (
          <span className="flex-1 rounded-xl bg-lime-soft py-2 text-center text-xs font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
            ✓ Permanent circle
          </span>
        ) : (
          <>
            <button
              onClick={() => promoteCircle(slug)}
              className="touch-target flex-1 rounded-xl bg-violet py-2 text-xs font-bold text-plum"
            >
              Keep it — make permanent
            </button>
            {!joined && (
              <Link
                href={`/circles/${slug}`}
                className="touch-target flex items-center justify-center rounded-xl bg-campus-bg px-3 py-2 text-xs font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
              >
                Visit
              </Link>
            )}
          </>
        )}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
        Temporary circles fade out automatically — members decide if they earn a permanent home.
      </p>
    </div>
  );
}

/* === Main explorer ========================================================== */

export default function CircleExplorer() {
  const params = useSearchParams();
  // Legacy deep links used the old 'groups' tab; groups now live in Circles.
  const requested = params.get('tab') ?? 'people';
  const [tab, setTab] = useState<CircleArea>(
    TAB_AREAS.includes(requested as CircleArea) && requested !== 'groups'
      ? (requested as CircleArea)
      : requested === 'groups'
        ? 'circles'
        : 'people',
  );
  const [peopleFilter, setPeopleFilter] = useState<string>('recommended');
  const [clubFilter, setClubFilter] = useState<string>('all');
  const {
    user,
    follows,
    joinedCircles,
    joinedGroups,
    toggleFollow,
    toggleJoinCircle,
    toggleJoinGroup,
    startConversation,
    plans,
    clubs: directoryClubs,
    clubsLoading,
    clubDirectoryError,
    managedClubSlugs,
    refreshClubs,
    people: directoryPeople,
    circles: directoryCircles,
    groups: directoryGroups,
  } = useApp();

  /* --- People ------------------------------------------------------------ */
  // The directory is real: public.profiles, filtered by the privacy-aware
  // profile policies. Sample students are never shown on a connected campus.
  const people = useMemo(() => {
    const all = directoryPeople.filter((p) => p.id !== user.id && p.discoverable);
    switch (peopleFilter) {
      case 'department':
        return all.filter((p) => p.departmentCode === user.departmentCode);
      case 'interests':
        return all.filter((p) =>
          p.interests.some((i) => ['Technology', 'Reading', 'Photography', 'Entrepreneurship', 'Volunteering'].includes(i)),
        );
      case 'circles':
        return all.filter((p) => (p.mutualCircles ?? []).length > 0);
      case 'new':
        return all.filter((p) => p.isNewAround);
      default:
        return all;
    }
  }, [peopleFilter, user.id, user.departmentCode, directoryPeople]);

  const messagePerson = (personId: string, name: string) => {
    const person = directoryPeople.find((p) => p.id === personId);
    const consent = canMessage(
      { allowMessages: person?.isVerified ? 'University Students Only' : 'Consent Requests Only' },
      true,
    );
    startConversation({
      personId,
      title: name,
      initialNote:
        consent === 'request'
          ? `Hi ${name.split(' ')[0]}! I'd like to connect on NUBCONNECT.`
          : `Hi ${name.split(' ')[0]}! Saw we share campus circles — want to connect?`,
    });
  };

  /* --- Clubs filters ------------------------------------------------------ */
  const clubCategories = useMemo(
    () => ['all', ...new Set(directoryClubs.map((c) => c.category))],
    [directoryClubs],
  );
  const filteredClubs =
    clubFilter === 'all'
      ? directoryClubs
      : directoryClubs.filter((c) => c.category === clubFilter);

  /* --- Circle areas -------------------------------------------------------- */
  const permanentCircles = directoryCircles.filter((c) => !c.temporary);
  const temporaryCircles = directoryCircles.filter((c) => c.temporary);
  // The event strip shows the real published feed, never sample events.
  const upcomingEvents = REAL_EVENTS.slice(0, 3);

  return (
    <div className="space-y-4">
      <header className="px-1">
        <p className="editorial-kicker mb-1 text-violet-ink dark:text-violet">Campus directory</p>
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Find Your Circle</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          People, clubs, interest circles and campus activities — around Northern University Bangladesh.
        </p>
      </header>

      <Tabs
        tabs={[
          { key: 'people', label: 'People', count: people.length },
          { key: 'clubs', label: 'Clubs', count: directoryClubs.length },
          { key: 'circles', label: 'Circles', count: permanentCircles.length + temporaryCircles.length + directoryGroups.length },
          { key: 'activities', label: 'Activities', count: plans.length },
        ]}
        active={tab}
        onChange={(k) => setTab(k as CircleArea)}
      />

      {/* PEOPLE — Discover People */}
      {tab === 'people' && (
        <>
          <CampusNowStrip />
          <IntroductionsSection />
          <section aria-labelledby="discover-people-h">
            <h2 id="discover-people-h" className="mb-2 px-1 font-display text-sm font-bold">
              Discover People
            </h2>
            <div className="no-scrollbar -mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
              {PEOPLE_FILTERS.map((f) => (
                <Chip key={f.key} active={peopleFilter === f.key} onClick={() => setPeopleFilter(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {people.map((p) => {
                const following = follows.includes(p.id);
                return (
                  <div key={p.id} className="card p-3">
                    <div className="flex items-start gap-3">
                      <Link href={`/profile/${p.username}`} aria-label={p.name}>
                        <Avatar seed={p.id} name={p.name} size={52} />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/profile/${p.username}`} className="font-display text-sm font-bold hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                          {p.departmentCode} • {p.semester}
                          {p.isVerified && ' • ✓ Verified'}
                        </p>
                        {(p.mutualCircles ?? []).length > 0 && (
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-violet-ink">
                            In your {p.mutualCircles![0]}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="line-clamp-2 mt-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                      {p.intro}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.interests.slice(0, 3).map((i) => (
                        <span key={i} className="rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                          {i}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => toggleFollow(p.id)}
                        aria-pressed={following}
                        className={`touch-target flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                          following
                            ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                            : 'bg-violet text-plum shadow-violet-glow'
                        }`}
                      >
                        {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                        {following ? 'Following' : 'Follow'}
                      </button>
                      <button
                        onClick={() => messagePerson(p.id, p.name)}
                        className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-campus-bg py-2 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                      >
                        <MessageCircle size={14} className="text-violet-ink" />
                        Message
                      </button>
                    </div>
                  </div>
                );
              })}
              {people.length === 0 && (
                <div className="card p-8 text-center sm:col-span-2">
                  <p className="font-display font-bold">No people match this filter</p>
                  <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                    Try a different discovery category.
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* CLUBS — Club Universe */}
      {tab === 'clubs' && (
        <>
          <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
            {clubCategories.map((c) => (
              <Chip key={c} active={clubFilter === c} onClick={() => setClubFilter(c)}>
                {c === 'all' ? 'All categories' : c}
              </Chip>
            ))}
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            The NUB club roster preserves official verification statuses and duplicate reconciliation from the
            Student Affairs department and club sources.{' '}
            <Link href="/help" className="font-bold text-violet-ink hover:underline">
              What do the verification levels mean?
            </Link>
          </p>
          {clubsLoading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="card animate-pulse p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-campus-bg dark:bg-campus-dark-elev" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-campus-bg dark:bg-campus-dark-elev" />
                      <div className="h-2.5 w-1/2 rounded bg-campus-bg dark:bg-campus-dark-elev" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!clubsLoading && clubDirectoryError && (
            <div className="card p-6 text-center">
              <p className="font-display font-bold">Club directory unavailable</p>
              <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                {clubDirectoryError}
              </p>
              <button
                onClick={() => void refreshClubs()}
                className="touch-target mt-3 rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum shadow-violet-glow"
              >
                Try again
              </button>
            </div>
          )}

          {!clubsLoading && !clubDirectoryError && filteredClubs.length === 0 && (
            <div className="card p-8 text-center">
              <p className="font-display font-bold">
                {directoryClubs.length === 0 ? 'No clubs published yet' : 'No clubs in this category'}
              </p>
              <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                {directoryClubs.length === 0
                  ? 'This deployment has no real club records yet. An administrator can add organizations from the university roster — nothing is invented here.'
                  : 'Try another category or clear the filter.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!clubsLoading &&
              filteredClubs.map((c) => {
                const mine = managedClubSlugs.includes(c.slug) || Boolean(c.isManager);
                return (
                  <div key={c.slug} className="card flex flex-col p-3 transition hover:shadow-lift">
                    <Link href={`/clubs/${c.slug}`} className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-aqua font-display text-sm font-extrabold text-plum">
                        {c.name.replace(/[^A-Z]/g, '').slice(0, 2) || 'CL'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-[13px] font-bold leading-snug">{c.name}</p>
                          {!c.organizationId && <DemoTag compact />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <VerifiedBadge label={c.verification ?? c.verificationStatus} />
                          {c.membershipOpen === false && (
                            <span className="rounded-full bg-campus-bg px-2 py-0.5 text-[10px] font-bold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                              Applications closed
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                          {c.category} • {c.scope} • {pluralize(c.memberCount, 'member')}
                        </p>
                      </div>
                    </Link>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                      {c.about}
                    </p>
                    {mine && (
                      <Link
                        href={`/clubs/${c.slug}/manage`}
                        className="touch-target mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-campus-bg py-2 text-xs font-bold text-violet-ink ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                      >
                        <Settings2 size={13} /> Club Control Center
                      </Link>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* CIRCLES — Interest Circles */}
      {tab === 'circles' && (
        <>
          <section aria-labelledby="interest-circles-h">
            <h2 id="interest-circles-h" className="mb-2 px-1 font-display text-sm font-bold">
              Interest Circles
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {permanentCircles.map((c) => {
                const joined = joinedCircles.includes(c.slug);
                return (
                  <div key={c.slug} className="card overflow-hidden p-0">
                    <Link href={`/circles/${c.slug}`} className="block">
                      <div className="relative h-24">
                        {c.isDemo ? (
                          <img src={coverScene(c.slug)} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-violet via-aqua to-lime" aria-hidden="true" />
                        )}
                        {c.isDemo && (
                          <span className="absolute right-2 top-2">
                            <DemoTag compact />
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/circles/${c.slug}`} className="font-display text-sm font-bold hover:underline">
                          {c.name}
                        </Link>
                        <span className="shrink-0 rounded-full bg-violet-soft px-2 py-0.5 text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                          {c.category}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                        {c.description}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                        <Users size={12} /> {pluralize(c.memberCount, 'member')}
                      </p>
                      <button
                        onClick={() => toggleJoinCircle(c.slug)}
                        aria-pressed={joined}
                        className={`touch-target mt-2.5 w-full rounded-xl py-2 text-xs font-bold transition ${
                          joined
                            ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                            : 'bg-violet text-plum shadow-violet-glow'
                        }`}
                      >
                        {joined ? '✓ Joined' : 'Join Circle'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {temporaryCircles.length > 0 && (
            <section aria-labelledby="temp-circles-h">
              <h2 id="temp-circles-h" className="mb-2 px-1 font-display text-sm font-bold">
                Temporary Circles
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {temporaryCircles.map((c) => (
                  <TemporaryCircleCard key={c.slug} slug={c.slug} />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="study-groups-h">
            <h2 id="study-groups-h" className="mb-2 px-1 font-display text-sm font-bold">
              Study &amp; Course Groups
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {directoryGroups.map((g) => {
                const joined = joinedGroups.includes(g.slug);
                return (
                  <div key={g.slug} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/groups/${g.slug}`} className="min-w-0">
                        <p className="font-display text-sm font-bold hover:underline">{g.name}</p>
                        <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                          {g.type} group • {pluralize(g.memberCount, 'member')}
                        </p>
                      </Link>
                      {g.isDemo && <DemoTag compact />}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                      {g.description}
                    </p>
                    <button
                      onClick={() => toggleJoinGroup(g.slug)}
                      aria-pressed={joined}
                      className={`touch-target mt-2.5 w-full rounded-xl py-2 text-xs font-bold transition ${
                        joined
                          ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                          : 'bg-violet text-plum shadow-violet-glow'
                      }`}
                    >
                      {joined ? '✓ Joined' : g.type === 'Course' ? 'Join Group' : 'Join / Request'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ACTIVITIES — Campus Activities */}
      {tab === 'activities' && (
        <>
          <PlansSection />
          <section aria-labelledby="campus-events-h">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 id="campus-events-h" className="font-display text-sm font-bold">
                Around campus this week
              </h2>
              <Link href="/events" className="text-[11px] font-bold text-violet-ink hover:underline">
                All events →
              </Link>
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {upcomingEvents.map((e) => (
                <Link
                  key={e.id}
                  href="/events"
                  className="w-60 shrink-0 rounded-2xl bg-campus-bg p-3 transition hover:shadow-lift dark:bg-campus-dark-elev"
                >
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-ink">
                    <CalendarClock size={11} /> {e.date}{e.startTime ? ` · ${e.startTime}` : ''}
                  </p>
                  <p className="mt-1 font-display text-[13px] font-bold leading-snug">{e.title}</p>
                  {e.venue && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      <MapPin size={10} /> {e.venue}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    {e.organizer}
                  </p>
                </Link>
              ))}
            </div>
          </section>
          <p className="px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            <ShieldCheck size={11} className="mr-1 inline align-[-2px] text-violet-ink" />
            Plans are meetups in public campus spots with participant limits — keep it that way. If a plan feels off,
            report it.
          </p>
        </>
      )}
    </div>
  );
}
