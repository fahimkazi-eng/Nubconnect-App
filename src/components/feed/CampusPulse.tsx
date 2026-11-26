'use client';

// ============================================================================
// CAMPUS PULSE — the Home strip.
//
// A compact, live view of the signature surface: who has chosen to be findable
// right now, and what is being planned. Every number here is a real row. When
// nobody has opted in, the card says so and invites the student to be first —
// it never manufactures presence.
//
// The full experience lives at /pulse. This strip opens the same composer on
// Home, so there is exactly one check-in flow across the app.
// ============================================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CalendarClock,
  ChevronRight,
  Clock,
  Handshake,
  Heart,
  MapPin,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { REAL_EVENTS } from '@/lib/nubEvents';
import { AnimatedCount, Avatar } from '@/components/ui/kit';
import AvailabilityComposer from '@/components/pulse/AvailabilityComposer';
import { remainingMinutes } from '@/lib/pulse';

/** Re-render once a minute so the remaining-minutes stay honest. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => (x + 1) % 1_000_000), 60_000);
    return () => clearInterval(t);
  }, []);
}

/** Tiny ECG trace — one static faint line, one animated bright sweep. */
function EcgTrace({ className = '' }: { className?: string }) {
  const points = '0,12 14,12 20,12 24,5 28,19 32,12 44,12 50,10 54,14 58,12 100,12';
  return (
    <svg viewBox="0 0 100 24" className={className} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="opacity-20"
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="animate-ecg"
      />
    </svg>
  );
}

export default function CampusPulse() {
  const { availability, activities, plans, pulseLoading, platformFlags } = useApp();
  const [composerOpen, setComposerOpen] = useState(false);
  useMinuteTick();

  const loading = pulseLoading && availability.length === 0;

  const mine = availability.find((a) => a.isMine) ?? null;
  const others = availability.filter((a) => !a.isMine);
  const onCampus = availability.filter((a) => a.onCampus);
  const spotlight = others[0];
  const latestRealEvent = REAL_EVENTS[0];

  // The switch is enforced by the database-backed flag, not by a local toggle.
  if (!platformFlags.campus_pulse) return null;

  // Prefer real activities; fall back to the session's own plans (demo mode).
  const livePlans = activities.length > 0 ? activities.length : plans.length;

  return (
    <section aria-labelledby="campus-pulse-h" className="relative">
      {/* Ambient floating accent (decorative only) */}
      <div
        aria-hidden="true"
        className="animate-float-slow pointer-events-none absolute -top-4 right-8 -z-10 h-24 w-44 rounded-full bg-violet-soft blur-2xl dark:bg-violet/20"
      />

      <div className="card p-0">
        {/* --- Who's on Campus? --------------------------------------------- */}
        <div className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <h2 id="campus-pulse-h" className="flex items-center gap-2 font-display text-[15px] font-bold">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-coral-soft"
              >
                <Heart size={14} className="animate-heartbeat fill-coral text-coral" />
              </span>
              Who&apos;s on Campus?
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-campus-bg px-2.5 py-1 dark:bg-campus-dark-elev">
              <EcgTrace className="h-4 w-14 text-violet-ink" />
              <span className="text-[11px] font-bold">
                {loading ? (
                  'Checking the pulse…'
                ) : (
                  <>
                    <AnimatedCount value={onCampus.length} />{' '}
                    {onCampus.length === 1 ? 'student' : 'students'} on campus
                  </>
                )}
              </span>
            </span>
          </div>

          {/* Participants preview — opens the full pulse */}
          <Link
            href="/pulse"
            className="touch-target mt-3 flex w-full items-center gap-3 rounded-2xl bg-campus-bg p-2.5 text-left transition hover:shadow-soft dark:bg-campus-dark-elev"
          >
            <span className="flex -space-x-2">
              {others.slice(0, 4).map((s) => (
                <Avatar
                  key={s.id}
                  seed={s.userId}
                  name={s.name}
                  size={34}
                  src={s.avatarUrl}
                  className="rounded-full ring-2 ring-campus-bg dark:ring-campus-dark-elev"
                />
              ))}
              {others.length > 4 && (
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-campus-card text-[10px] font-bold text-campus-text-sec ring-2 ring-campus-bg dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-elev">
                  +{others.length - 4}
                </span>
              )}
              {others.length === 0 && (
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-campus-card text-campus-text-sec ring-2 ring-campus-bg dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-elev">
                  <Users size={15} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">
                {loading
                  ? 'Checking the pulse…'
                  : spotlight
                    ? `${spotlight.name.split(' ')[0]} is ${spotlight.status.label.toLowerCase()}${
                        spotlight.spot ? ` · ${spotlight.spot}` : ''
                      }`
                    : mine
                      ? 'Only you on the pulse so far'
                      : 'Nobody has shared availability yet'}
              </span>
              <span className="block truncate text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                {loading
                  ? 'Opt-in statuses, auto-expiring'
                  : spotlight
                    ? `${spotlight.openToConnect ? 'Open to Connect · ' : ''}${remainingMinutes(spotlight.expiresAt)} min left`
                    : availability.length === 0
                      ? 'Opt-in statuses, auto-expiring — be the first'
                      : `${availability.length} ${availability.length === 1 ? 'student is' : 'students are'} around`}
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
          </Link>

          {/* Check in / manage */}
          <div className="mt-3">
            {!mine ? (
              <button
                onClick={() => setComposerOpen(true)}
                className="touch-target flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet py-2.5 text-sm font-bold text-plum shadow-violet-glow transition active:scale-[0.98]"
              >
                <MapPin size={15} /> I&apos;m on campus
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-violet-soft p-2.5 dark:bg-violet-dark-soft">
                <p className="min-w-0 text-xs font-bold">
                  You&apos;re on the pulse — {mine.status.label}
                  {mine.onCampus ? ' · on campus' : ''}
                  {mine.openToConnect && ' · Open to Connect'}
                  <span className="block text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    {remainingMinutes(mine.expiresAt)} min left · auto-expires, no location shared
                  </span>
                </p>
                <button
                  onClick={() => setComposerOpen(true)}
                  className="touch-target shrink-0 rounded-lg bg-campus-card px-2.5 py-1.5 text-[10px] font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
                >
                  Update
                </button>
              </div>
            )}
          </div>
        </div>

        {/* --- Orbit teasers (secondary row) ---------------------------------- */}
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto border-t border-campus-border px-1 pb-2 pt-2 dark:border-campus-dark-border">
          <Link
            href="/pulse"
            className="group w-44 shrink-0 rounded-2xl bg-sunshine-soft p-2.5 transition hover:shadow-lift dark:bg-amber-400/10"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <CalendarClock size={11} /> Campus Pulse
            </p>
            <p className="mt-1 font-display text-[13px] font-extrabold leading-snug">
              {livePlans > 0 ? `${livePlans} ${livePlans === 1 ? 'activity' : 'activities'} open` : 'Start something'}
            </p>
            <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 group-hover:underline dark:text-amber-300">
              Find company <ChevronRight size={10} />
            </span>
          </Link>

          {latestRealEvent && (
            <Link
              href="/events"
              className="group w-52 shrink-0 rounded-2xl bg-aqua-soft p-2.5 transition hover:shadow-lift dark:bg-aqua/10"
            >
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-aqua-ink dark:text-aqua">
                <Calendar size={11} /> Latest on campus
              </p>
              <p className="mt-1 line-clamp-2 font-display text-[13px] font-extrabold leading-snug">
                {latestRealEvent.title}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-aqua-ink dark:text-aqua">
                From nub.ac.bd · official
              </p>
            </Link>
          )}

          <Link
            href="/honours"
            className="group w-44 shrink-0 rounded-2xl bg-lime-soft p-2.5 transition hover:shadow-lift dark:bg-lime/15"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-lime-ink dark:text-lime">
              <Trophy size={11} /> Campus Honours
            </p>
            <p className="mt-1 font-display text-[13px] font-extrabold leading-snug">Contributions, not popularity</p>
            <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-lime-ink group-hover:underline dark:text-lime">
              See honours <ChevronRight size={10} />
            </span>
          </Link>
        </div>

        {/* The honesty note — presence is always opt-in. */}
        <div className="flex items-center gap-1.5 border-t border-campus-border px-3.5 py-2 text-[10px] font-semibold text-campus-text-sec dark:border-campus-dark-border dark:text-campus-dark-sec">
          <Timer size={10} className="shrink-0" />
          Opt-in only. Statuses expire on their own and never share your location.
          <Link href="/pulse" className="ml-auto shrink-0 font-bold text-violet-ink hover:underline dark:text-violet">
            Open pulse
          </Link>
        </div>
      </div>

      <AvailabilityComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
    </section>
  );
}
