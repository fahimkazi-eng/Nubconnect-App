'use client';

// Campus events — register/unregister with an optimistic toggle. Event data
// is sourced from clubs and departments when the backend is connected; the
// demo entries are clearly labelled. The "Official — from nub.ac.bd" section
// below preserves NUB's REAL published events (titles verbatim, each linking
// to its original article) with contextual Interested / Going responses.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarDays, Check, ExternalLink, MapPin, Ticket, Users2 } from 'lucide-react';
import { DEMO_EVENTS } from '@/lib/demo/dataset';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { loadCampusEvents } from '@/lib/events';
import { NUB_EVENTS_FEED_URL, REAL_EVENTS } from '@/lib/nubEvents';
import { useApp } from '@/lib/store';
import { DemoTag, EmptyState } from '@/components/ui/kit';

export default function EventsPage() {
  const { pushToast } = useApp();
  const configured = isBackendConfigured();
  // Sample events are a development fixture; a connected campus shows only
  // events actually published to its database.
  const [events, setEvents] = useState(() => (configured ? [] : DEMO_EVENTS));
  const [eventsLoading, setEventsLoading] = useState(configured);
  const [eventsError, setEventsError] = useState<string | null>(null);
  // Registration map over the demo events (session state in demo mode).
  const [registered, setRegistered] = useState<Record<string, boolean>>(
    Object.fromEntries(DEMO_EVENTS.map((e) => [e.id, e.registered])),
  );
  // Contextual Interested / Going responses for the official nub.ac.bd events
  // (§8) — local session state, one response at a time, tap again to clear.
  const [interest, setInterest] = useState<Record<string, 'interested' | 'going' | null>>(
    Object.fromEntries(REAL_EVENTS.map((e) => [e.id, e.interest ?? null])),
  );

  useEffect(() => {
    if (!configured) return;
    let active = true;
    void loadCampusEvents(getSupabaseBrowserClient()).then(({ events: rows, error }) => {
      if (!active) return;
      setEvents(rows);
      setEventsError(error ?? null);
      setEventsLoading(false);
    });
    return () => { active = false; };
  }, [configured]);

  // `event_registrations` has no owner-scoped write policy in this schema, so
  // a click here could not honestly claim a stored registration in real mode.
  const toggle = (id: string, title: string) => {
    if (configured) return;
    const next = !registered[id];
    setRegistered((r) => ({ ...r, [id]: next }));
    pushToast(next ? `You're registered for “${title}”.` : `Registration cancelled for “${title}”.`, next ? 'success' : 'default');
  };

  const toggleInterest = (id: string, next: 'interested' | 'going') => {
    setInterest((m) => ({ ...m, [id]: m[id] === next ? null : next }));
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Campus Events</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Club meetups, department programs and campus-wide moments — all in one place.
        </p>
      </header>

      {eventsLoading ? (
        <div className="card p-5 text-center text-sm font-semibold text-campus-text-sec dark:text-campus-dark-sec" role="status" aria-label="Loading campus events">
          Loading events…
        </div>
      ) : eventsError ? (
        <div className="card flex items-start gap-3 p-4 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-coral-ink dark:text-coral" />
          <p>{eventsError}</p>
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon={<CalendarDays size={22} />} title="No events yet" body="When clubs and departments post events, they show up here." />
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const isRegistered = registered[e.id] ?? false;
            return (
              <article key={e.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-violet-soft dark:bg-violet-dark-soft">
                    <span className="font-mono text-[10px] font-bold uppercase text-violet-ink dark:text-violet">
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="font-display text-xl font-extrabold leading-none text-violet-ink dark:text-violet">
                      {new Date(e.date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[15px] font-bold leading-tight">{e.title}</h2>
                      {e.isDemo && <DemoTag compact />}
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      <span className="inline-flex items-center gap-1">
                        <Users2 size={11} /> {e.organizer}
                      </span>
                      {e.venue && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} /> {e.venue}
                        </span>
                      )}
                      {e.startTime && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={11} /> {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })} • {e.startTime}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => toggle(e.id, e.title)}
                    aria-pressed={isRegistered}
                    disabled={configured}
                    title={configured ? 'Event registration requires an owner-scoped backend write path.' : undefined}
                    className={`touch-target flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isRegistered
                        ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                        : 'bg-violet text-plum shadow-violet-glow'
                    }`}
                  >
                    {configured ? (
                      'Registration requires backend support'
                    ) : isRegistered ? (
                      <><Check size={14} /> Registered</>
                    ) : (
                      <><Ticket size={14} /> Register</>
                    )}
                  </button>
                  <span className="rounded-full bg-campus-bg px-2.5 py-1 text-[10px] font-bold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                    {e.originLabel}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Official — REAL events published by NUB on nub.ac.bd.
          Titles are preserved verbatim; the feed does not publish venue or
          start times, so those are intentionally absent. */}
      <section aria-labelledby="official-events-h" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 px-1">
          <h2 id="official-events-h" className="font-display text-base font-bold">
            Official — from nub.ac.bd
          </h2>
          <a
            href={NUB_EVENTS_FEED_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-violet-ink hover:underline dark:text-violet"
          >
            View source feed <ExternalLink size={10} />
          </a>
        </div>
        <p className="-mt-1.5 px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          Events Northern University Bangladesh published on its official site (Feb–Jul 2026).
          Titles are preserved verbatim; venue and time are not published in the feed.
          Interested / Going are this device's session responses only — they are not sent to the university.
        </p>
        <div className="space-y-3">
          {REAL_EVENTS.map((e) => {
            const my = interest[e.id] ?? null;
            return (
              <article key={e.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-aqua-soft dark:bg-aqua/10">
                    <span className="font-mono text-[10px] font-bold uppercase text-aqua-ink dark:text-aqua">
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="font-display text-xl font-extrabold leading-none text-aqua-ink dark:text-aqua">
                      {new Date(e.date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[15px] font-bold leading-tight">{e.title}</h3>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      <span className="inline-flex items-center gap-1">
                        <Users2 size={11} /> {e.organizer}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-aqua py-2.5 text-xs font-bold text-plum transition active:scale-[0.98]"
                  >
                    Read on nub.ac.bd <ExternalLink size={13} />
                  </a>
                  <button
                    onClick={() => toggleInterest(e.id, 'interested')}
                    aria-pressed={my === 'interested'}
                    className={`touch-target flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                      my === 'interested'
                        ? 'bg-violet-soft text-violet-ink ring-1 ring-violet/40 dark:bg-violet-dark-soft dark:text-violet'
                        : 'bg-campus-bg text-campus-text-sec ring-1 ring-campus-border hover:text-violet-ink dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border dark:hover:text-violet'
                    }`}
                  >
                    ⭐ Interested
                  </button>
                  <button
                    onClick={() => toggleInterest(e.id, 'going')}
                    aria-pressed={my === 'going'}
                    className={`touch-target flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                      my === 'going'
                        ? 'bg-lime-soft text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime'
                        : 'bg-campus-bg text-campus-text-sec ring-1 ring-campus-border hover:text-violet-ink dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border dark:hover:text-violet'
                    }`}
                  >
                    ✅ Going
                  </button>
                  <span className="w-full text-[10px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
                    This choice stays on this device — it is not sent to NUB or synced anywhere.
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="px-1 text-center text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
        Want to post an event? <Link href="/circle?tab=clubs" className="font-bold text-violet-ink hover:underline">Club representatives</Link> can publish to their club page.
      </p>
    </div>
  );
}
