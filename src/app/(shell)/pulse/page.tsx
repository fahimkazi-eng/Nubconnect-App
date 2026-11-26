'use client';

// ============================================================================
// CAMPUS PULSE — who's around campus right now.
//
// This is the signature surface of NUBCONNECT. It answers one question honestly:
// who has chosen, right now, to be findable — and what are people planning?
//
// The rules it never breaks:
//   • nothing is shown unless the student opted in;
//   • being signed in never counts as being on campus;
//   • every status and check-in expires on its own;
//   • counts come from real rows, so an empty campus looks empty;
//   • no precise location, ever.
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarPlus,
  Flag,
  ImagePlus,
  MapPin,
  MessageCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { deleteUploadedMedia, uploadMedia } from '@/lib/storage/client';
import {
  ACTIVITY_REPORT_REASONS,
  cancelActivity,
  loadActivityConversations,
  PULSE_INTENTS,
  remainingMinutes,
  reportActivity,
  updateActivityCover,
  type ActivityReportReason,
  type PulseActivity,
  type PulseAvailability,
} from '@/lib/pulse';
import { AnimatedCount, Avatar, EmptyState } from '@/components/ui/kit';
import AvailabilityComposer from '@/components/pulse/AvailabilityComposer';
import ActivityComposer from '@/components/pulse/ActivityComposer';
import PulsePersonCard from '@/components/pulse/PulsePersonCard';
import PulseActivityCard from '@/components/pulse/PulseActivityCard';

/** Keep countdowns and "happening now" labels honest without polling. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => (x + 1) % 1_000_000), 60_000);
    return () => clearInterval(t);
  }, []);
}

const INTENT_COPY: Record<string, { one: string; many: string }> = {
  on_campus: { one: 'student is on campus', many: 'students are on campus' },
  free_to_chat: { one: 'student is free to chat', many: 'students are free to chat' },
  coffee: { one: 'student is up for coffee', many: 'students are up for coffee' },
  hangout: { one: 'student is up for a hangout', many: 'students are up for a hangout' },
  study: { one: 'student is up for studying', many: 'students are up for studying' },
  sports: { one: 'student is looking for a team', many: 'students are looking for a team' },
  photography: { one: 'student is into photography', many: 'students are into photography' },
  gaming: { one: 'student is up for gaming', many: 'students are up for gaming' },
};

const TOOL_INPUT =
  'touch-target w-full rounded-lg border border-campus-border bg-campus-card px-2.5 py-2 text-[11px] outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card';

/**
 * Real persistence for the things a plan card cannot invent: an uploaded cover,
 * a host-confirmed cancellation, a stored report, the people who actually
 * joined, and a chat link only when a conversation row exists.
 */
function ActivityTools({
  activity,
  conversationId,
  onChanged,
}: {
  activity: PulseActivity;
  conversationId: string | null;
  onChanged: () => void;
}) {
  const { user, pushToast } = useApp();
  const client = getSupabaseBrowserClient();
  const [coverBusy, setCoverBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ActivityReportReason>('spam');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addCover = async (file: File | undefined) => {
    if (!file || !client) return;
    setCoverBusy(true);
    setError(null);
    const uploaded = await uploadMedia(client, { kind: 'cover', file });
    if (!uploaded.ok) {
      setError(uploaded.error);
      setCoverBusy(false);
      return;
    }
    const saved = await updateActivityCover(client, {
      planId: activity.id,
      creatorId: user.id,
      coverUrl: uploaded.data.url,
    });
    if (!saved.ok) {
      // Do not leave an orphaned object behind when the write fails.
      await deleteUploadedMedia('cover', [uploaded.data.key]);
      setError(saved.error ?? 'The photo could not be attached.');
    } else {
      pushToast('Cover photo added', 'success');
      onChanged();
    }
    setCoverBusy(false);
  };

  const cancel = async () => {
    if (!client) return;
    const confirmed = window.confirm(
      `Cancel “${activity.title}”? The activity stays on record as cancelled; nobody is removed or deleted.`,
    );
    if (!confirmed) return;
    setActionBusy(true);
    setError(null);
    const result = await cancelActivity(client, { planId: activity.id, creatorId: user.id });
    setActionBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not cancel that activity.');
      return;
    }
    pushToast('Activity cancelled — it is no longer open', 'success');
    onChanged();
  };

  const submitReport = async () => {
    if (!client || !user.primaryUniversityId) {
      setError('Your account is not linked to a university yet.');
      return;
    }
    setActionBusy(true);
    setError(null);
    const result = await reportActivity(client, {
      reporterId: user.id,
      universityId: user.primaryUniversityId,
      planId: activity.id,
      reasonCategory: reason,
      details,
    });
    setActionBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'The report could not be saved.');
      return;
    }
    setReportOpen(false);
    setDetails('');
    pushToast('Report saved for admin review', 'success');
  };

  const people = activity.participants.map((p) => p.name).join(', ');
  const requests = activity.pendingRequests
    .map((r) => (r.note ? `${r.name} — ${r.note}` : r.name))
    .join('; ');

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-campus-border px-3.5 py-2.5 dark:border-campus-dark-border">
      <details className="min-w-0 flex-1 rounded-lg bg-campus-bg px-2.5 py-2 text-[10px] dark:bg-campus-dark-elev">
        <summary className="cursor-pointer font-bold">
          People ({activity.participantCount})
          {activity.isMine && activity.pendingRequests.length > 0
            ? ` · ${activity.pendingRequests.length} waiting`
            : ''}
        </summary>
        <p className="mt-1 leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          {people || 'Nobody has joined yet.'}
        </p>
        {activity.isMine && activity.pendingRequests.length > 0 && (
          <p className="mt-1 leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Join requests: {requests}. Respond to them on the activity card above.
          </p>
        )}
      </details>

      {conversationId ? (
        <Link
          href={`/messages/${conversationId}`}
          className="touch-target inline-flex items-center gap-1 rounded-lg bg-aqua-soft px-2.5 py-2 text-[10px] font-bold text-aqua-ink dark:bg-aqua/15 dark:text-aqua"
        >
          <MessageCircle size={12} /> Open group chat
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title="This backend does not provision conversations for activities."
          className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-campus-bg px-2.5 py-2 text-[10px] font-semibold text-campus-text-sec opacity-70 dark:bg-campus-dark-elev dark:text-campus-dark-sec"
        >
          <MessageCircle size={12} /> Group chat requires backend support
        </button>
      )}

      {activity.isMine ? (
        <>
          {activity.coverUrl ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-lime-soft px-2.5 py-2 text-[10px] font-bold text-lime-ink dark:bg-lime/15 dark:text-lime">
              <ImagePlus size={12} /> Cover photo added
            </span>
          ) : (
            <label className="touch-target inline-flex cursor-pointer items-center gap-1 rounded-lg bg-violet-soft px-2.5 py-2 text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
              <ImagePlus size={12} /> {coverBusy ? 'Uploading…' : 'Add cover photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={coverBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void addCover(file);
                }}
              />
            </label>
          )}
          <button
            onClick={() => void cancel()}
            disabled={actionBusy}
            className="touch-target inline-flex items-center gap-1 rounded-lg bg-coral-soft px-2.5 py-2 text-[10px] font-bold text-coral-ink disabled:opacity-40 dark:bg-coral/15 dark:text-coral"
          >
            <Flag size={12} /> Cancel activity
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            setReportOpen((open) => !open);
            setError(null);
          }}
          aria-expanded={reportOpen}
          className="touch-target inline-flex items-center gap-1 rounded-lg bg-campus-bg px-2.5 py-2 text-[10px] font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border"
        >
          <Flag size={12} /> Report
        </button>
      )}

      {reportOpen && !activity.isMine && (
        <div className="w-full rounded-xl border border-campus-border p-2.5 dark:border-campus-dark-border">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
            Why report this activity?
          </label>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ActivityReportReason)}
            className={TOOL_INPUT + ' mb-2'}
          >
            {ACTIVITY_REPORT_REASONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Optional context for moderators"
            className={TOOL_INPUT + ' mb-2 resize-none'}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void submitReport()}
              disabled={actionBusy}
              className="touch-target rounded-lg bg-violet px-3 py-2 text-[10px] font-bold text-plum disabled:opacity-40"
            >
              {actionBusy ? 'Saving…' : 'Save report'}
            </button>
            <button
              onClick={() => setReportOpen(false)}
              className="touch-target rounded-lg bg-campus-bg px-3 py-2 text-[10px] font-bold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="w-full rounded-lg bg-coral-soft px-2.5 py-2 text-[10px] font-semibold text-coral-ink dark:bg-coral/15 dark:text-coral"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default function PulsePage() {
  const {
    availability,
    activities,
    pulseLoading,
    isDemoUser,
    authLoading,
    platformFlags,
    refreshPulse,
  } = useApp();
  useMinuteTick();

  const [intent, setIntent] = useState('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [conversationIds, setConversationIds] = useState<Record<string, string>>({});

  const signedOut = !authLoading && isBackendConfigured() && isDemoUser;

  // A chat entry is only offered when a stored conversation names this plan.
  // This is a read on data changes, not polling.
  useEffect(() => {
    let cancelled = false;
    if (!isBackendConfigured() || signedOut || activities.length === 0) {
      setConversationIds({});
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setConversationIds({});
      return;
    }
    void loadActivityConversations(client, activities.map((a) => a.id)).then((linked) => {
      if (!cancelled) setConversationIds(linked);
    });
    return () => {
      cancelled = true;
    };
  }, [activities, signedOut]);

  const mine = availability.find((a) => a.isMine) ?? null;
  const others = useMemo(() => availability.filter((a) => !a.isMine), [availability]);

  const matchesIntent = (a: PulseAvailability) => {
    if (intent === 'all') return true;
    if (intent === 'on_campus') return a.onCampus;
    return a.status.intent === intent;
  };

  const visible = others.filter(matchesIntent);

  // The strip is a filter over *other* people, so it counts other people only.
  // The live headline above still counts everyone who opted in, including you.
  const countsByIntent = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of PULSE_INTENTS) {
      if (i.key === 'all') {
        counts[i.key] = others.length;
      } else if (i.key === 'on_campus') {
        counts[i.key] = others.filter((a) => a.onCampus).length;
      } else {
        counts[i.key] = others.filter((a) => a.status.intent === i.key).length;
      }
    }
    return counts;
  }, [others]);

  const onCampusCount = useMemo(
    () => availability.filter((a) => a.onCampus).length,
    [availability],
  );
  const openActivities = activities.length;
  const myActivities = activities.filter((a) => a.isMine || a.isJoined);

  // The filter chips only offer intentions that somebody actually has.
  const availableIntents = PULSE_INTENTS.filter(
    (i) => i.key === 'all' || (countsByIntent[i.key] ?? 0) > 0,
  );

  return (
    <div className="space-y-4">
      {!platformFlags.campus_pulse ? (
        <EmptyState
          icon={<Radio size={22} />}
          title="Campus Pulse is paused"
          body="An administrator turned Campus Pulse off. Your availability and activities were not deleted — they will return when the feature is switched back on."
        />
      ) : (
        <>
      <header className="px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">
            Who&apos;s on campus right now?
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-lime-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-ink dark:bg-lime/15 dark:text-lime">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime" />
            </span>
            Live
          </span>
        </div>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Opt-in, auto-expiring availability — and the plans people are making right now.
        </p>
      </header>

      {authLoading ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading Campus Pulse">
          <div className="skeleton h-40 w-full rounded-2xl" />
          <div className="skeleton h-24 w-full rounded-2xl" />
          <div className="skeleton h-40 w-full rounded-2xl" />
        </div>
      ) : signedOut ? (
        <EmptyState
          icon={<Radio size={22} />}
          title="Sign in to join the pulse"
          body="Campus Pulse is only visible to students of your university. Sign in to see who is around and to share your own status."
          action={
            <Link
              href="/auth/login"
              className="mt-1 rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-plum shadow-violet-glow"
            >
              Sign in
            </Link>
          }
        />
      ) : (
        <>
          {/* --- Live snapshot ------------------------------------------------- */}
          <section className="card overflow-hidden p-0" aria-label="Campus pulse right now">
            <div className="bg-gradient-to-br from-violet-soft via-campus-card to-aqua-soft p-4 dark:from-[#2C2560] dark:via-campus-dark-card dark:to-[#1c2c50]">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl font-extrabold leading-none">
                    <AnimatedCount value={onCampusCount} />
                  </p>
                  <p className="mt-1 text-xs font-bold">
                    {onCampusCount === 1 ? 'student checked in on campus' : 'students checked in on campus'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    {availability.length === 0
                      ? 'Nobody has shared availability yet — an empty campus is honest.'
                      : `${availability.length} ${availability.length === 1 ? 'student has' : 'students have'} shared availability · ${openActivities} open ${openActivities === 1 ? 'activity' : 'activities'}`}
                  </p>
                </div>
                <div className="flex shrink-0 -space-x-2">
                  {availability.slice(0, 4).map((a) => (
                    <Avatar
                      key={a.id}
                      seed={a.userId}
                      name={a.name}
                      size={34}
                      src={a.avatarUrl}
                      className="ring-2 ring-campus-card dark:ring-campus-dark-card"
                    />
                  ))}
                  {availability.length === 0 && (
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-campus-card text-campus-text-sec ring-2 ring-campus-card dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-card">
                      <Users size={15} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* --- My availability ------------------------------------------- */}
            <div className="border-t border-campus-border p-3.5 dark:border-campus-dark-border">
              {mine ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-soft p-3 dark:bg-violet-dark-soft">
                  <div className="min-w-0">
                    <p className="text-xs font-bold">
                      Your status is live — {mine.status.emoji} {mine.status.label}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      {remainingMinutes(mine.expiresAt)} min left
                      {mine.onCampus ? ' · checked in on campus' : ''}
                      {mine.openToConnect ? ' · Open to Connect' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="touch-target shrink-0 rounded-lg bg-campus-card px-3 py-1.5 text-[10px] font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                  >
                    Update
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setComposerOpen(true)}
                  className="touch-target flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet py-2.5 text-sm font-bold text-plum shadow-violet-glow transition active:scale-[0.98]"
                >
                  <MapPin size={15} /> Share what you&apos;re up for
                </button>
              )}
            </div>
          </section>

          {/* --- Activity-first invitations --------------------------------- */}
          {availableIntents.length > 1 && (
            <section aria-label="What people are up for right now">
              <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
                {availableIntents
                  .filter((i) => i.key !== 'all')
                  .map((i) => {
                    const count = countsByIntent[i.key] ?? 0;
                    const copy = INTENT_COPY[i.key];
                    return (
                      <button
                        key={i.key}
                        onClick={() => setIntent(intent === i.key ? 'all' : i.key)}
                        aria-pressed={intent === i.key}
                        className={`card w-40 shrink-0 p-2.5 text-left transition hover:shadow-lift ${
                          intent === i.key ? 'ring-2 ring-violet' : ''
                        }`}
                      >
                        <p className="text-lg" aria-hidden>
                          {i.emoji}
                        </p>
                        <p className="mt-0.5 font-display text-lg font-extrabold leading-none">
                          {count}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold leading-snug text-campus-text-sec dark:text-campus-dark-sec">
                          {count === 1 ? copy.one : copy.many}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </section>
          )}

          {/* --- Around you -------------------------------------------------- */}
          <section aria-labelledby="around-h" className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 px-1">
              <h2 id="around-h" className="font-display text-base font-bold">
                Around you
              </h2>
              <span className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                Everyone here opted in
              </span>
            </div>

            <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
              {availableIntents.map((i) => (
                <button
                  key={i.key}
                  onClick={() => setIntent(i.key)}
                  aria-pressed={intent === i.key}
                  className={`touch-target inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    intent === i.key
                      ? 'bg-violet text-plum shadow-violet-glow'
                      : 'bg-campus-card text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
                  }`}
                >
                  <span aria-hidden>{i.emoji}</span>
                  {i.label}
                  {i.key !== 'all' && (
                    <span className={intent === i.key ? 'opacity-70' : 'opacity-60'}>
                      {countsByIntent[i.key] ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {pulseLoading && availability.length === 0 ? (
              <div className="space-y-2.5">
                <div className="skeleton h-28 w-full rounded-2xl" />
                <div className="skeleton h-28 w-full rounded-2xl" />
              </div>
            ) : visible.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {visible.map((entry) => (
                  <PulsePersonCard key={entry.id} entry={entry} />
                ))}
              </div>
            ) : others.length > 0 ? (
              <EmptyState
                icon={<Sparkles size={22} />}
                title="Nobody matches that right now"
                body="Try another intention — or be the one who starts it."
                action={
                  <button
                    onClick={() => setIntent('all')}
                    className="mt-1 rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum"
                  >
                    Show everyone
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users size={22} />}
                title={mine ? "You're first on the pulse" : 'The campus is quiet right now'}
                body={
                  mine
                    ? 'Your status is live. No other student has shared availability yet — check back in a little while.'
                    : 'No other student has shared availability yet. Put yourself on the pulse and give people someone to find.'
                }
                action={
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="mt-1 rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-plum shadow-violet-glow"
                  >
                    {mine ? 'Update my status' : 'Share my availability'}
                  </button>
                }
              />
            )}
          </section>

          {/* --- Activities -------------------------------------------------- */}
          <section aria-labelledby="activities-h" className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 id="activities-h" className="flex items-center gap-1.5 font-display text-base font-bold">
                <Activity size={15} className="text-violet-ink dark:text-violet" /> Happening around campus
              </h2>
              <button
                onClick={() => setActivityOpen(true)}
                className="touch-target inline-flex items-center gap-1 rounded-full bg-violet px-3 py-1.5 text-[11px] font-bold text-plum shadow-violet-glow"
              >
                <CalendarPlus size={12} /> Start something
              </button>
            </div>

            <p className="-mt-1 px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Small, real-life plans with a participant limit. Counts are the people who actually
              joined.
            </p>

            {myActivities.length > 0 && (
              <p className="px-1 text-[11px] font-bold text-lime-ink dark:text-lime">
                You&apos;re hosting or joining {myActivities.length}{' '}
                {myActivities.length === 1 ? 'activity' : 'activities'}.
              </p>
            )}

            {pulseLoading && activities.length === 0 ? (
              <div className="skeleton h-32 w-full rounded-2xl" />
            ) : activities.length > 0 ? (
              <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
                {activities.map((activity) => (
                  <div key={activity.id} className="space-y-2">
                    {activity.coverUrl && (
                      <div className="overflow-hidden rounded-2xl bg-campus-card dark:bg-campus-dark-card">
                        <img
                          src={activity.coverUrl}
                          alt={`Photograph for ${activity.title}`}
                          loading="lazy"
                          className="aspect-[16/7] w-full object-cover"
                        />
                      </div>
                    )}
                    <PulseActivityCard activity={activity} />
                    <ActivityTools
                      activity={activity}
                      conversationId={conversationIds[activity.id] ?? null}
                      onChanged={() => void refreshPulse()}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Activity size={22} />}
                title="No activities yet"
                body="Nothing is planned right now. A coffee break, a study hour, a kickabout — it starts with one person."
                action={
                  <button
                    onClick={() => setActivityOpen(true)}
                    className="mt-1 rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-plum shadow-violet-glow"
                  >
                    Start an activity
                  </button>
                }
              />
            )}
          </section>

          {/* --- The promise -------------------------------------------------- */}
          <p className="flex items-start gap-2 px-1 pb-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-violet-ink dark:text-violet" />
            <span>
              Campus Pulse never tracks your location. A check-in is something you publish yourself,
              it expires automatically, and you choose who can see it. Being signed in never means
              you are on campus.
              <Link href="/privacy" className="ml-1 font-bold text-violet-ink hover:underline dark:text-violet">
                Read the privacy promise
              </Link>
            </span>
          </p>
        </>
      )}

      <AvailabilityComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
      <ActivityComposer open={activityOpen} onClose={() => setActivityOpen(false)} />
        </>
      )}
    </div>
  );
}
