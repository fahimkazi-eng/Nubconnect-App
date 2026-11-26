'use client';

// ============================================================================
// WHO'S ON CAMPUS? — compact, full-width live-presence banner.
//
// Every face here belongs to a real student who explicitly published an
// unexpired availability status. There are no generated faces, no sample
// people and no inflated headcounts. The whole banner opens the dedicated
// Campus Pulse discovery page; detailed filters and profile actions live
// there, not in this strip.
//
// "Campus live" describes self-published, expiring status — never a location
// feed or a claim that someone is signed in right now.
// ============================================================================

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useApp } from '@/lib/store';
import { initials } from '@/lib/format';

const MAX_PORTRAITS = 5;

export default function WhosOnCampus() {
  const { availability, pulseLoading, platformFlags } = useApp();

  if (!platformFlags.campus_pulse) return null;

  const loading = pulseLoading && availability.length === 0;
  const onCampus = availability.filter((a) => a.onCampus);
  const hasPresence = availability.length > 0;
  const portraits = availability.slice(0, MAX_PORTRAITS);

  // All counts are derived from real, unexpired opt-in rows. Zero is always
  // stated honestly instead of being filled with sample activity.
  const support = loading
    ? 'Checking who has shared a live status…'
    : onCampus.length > 0
      ? `${onCampus.length} ${onCampus.length === 1 ? 'student' : 'students'} checked in on campus`
      : hasPresence
        ? `${availability.length} sharing a campus status`
        : 'No check-ins yet — share yours to start.';

  return (
    <Link
      href="/pulse"
      aria-label="Explore who's on campus"
      className="campus-live-banner group relative isolate flex min-h-[108px] w-full items-center justify-between gap-3 overflow-hidden rounded-[22px] px-4 py-4 text-white shadow-[0_18px_45px_-24px_rgba(9,20,31,0.9)] ring-1 ring-white/10 transition duration-300 ease-out hover:brightness-110 active:scale-[0.995] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-editorial-lime sm:min-h-[116px] sm:gap-5 sm:rounded-[26px] sm:px-6 sm:py-5"
    >
      <div className="min-w-0">
        <p className="editorial-kicker flex items-center gap-2 text-editorial-lime">
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
            {hasPresence && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-editorial-lime opacity-60" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${hasPresence ? 'bg-editorial-lime' : 'bg-white/40'}`}
            />
          </span>
          {hasPresence ? 'Campus live · opt-in' : 'Campus presence · opt-in'}
        </p>
        <h2 className="mt-1 font-display text-lg font-extrabold leading-tight tracking-tight sm:text-xl">
          Who&apos;s on <span className="font-editorial font-normal italic text-editorial-lime">campus?</span>
        </h2>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/70 sm:text-[13px]">
          {support}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        {portraits.length > 0 && (
          // Decorative inside a link whose text already names the destination.
          <div aria-hidden="true" className="flex items-center pl-2">
            {portraits.map((person, i) => (
              <span
                key={person.id}
                className={`campus-portrait-float relative -ml-2 first:ml-0 ${i >= 3 ? 'hidden sm:block' : ''}`}
                style={{ animationDelay: `${i * -0.9}s` }}
              >
                {person.avatarUrl ? (
                  // Student-owned photo from the avatars bucket. Raw img is
                  // intentional: remote hosts are not next/image allowlisted.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={person.avatarUrl}
                    alt=""
                    loading="lazy"
                    className="h-9 w-9 rounded-full border-2 border-white/85 object-cover shadow-[0_6px_16px_-6px_rgba(0,0,0,0.7)] sm:h-10 sm:w-10"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/85 bg-editorial-violet font-display text-[11px] font-extrabold text-editorial-ink sm:h-10 sm:w-10">
                    {initials(person.name)}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        <span className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold backdrop-blur-sm transition duration-300 group-hover:border-editorial-lime/50 group-hover:bg-white/15">
          Explore
          <ArrowUpRight
            size={13}
            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </Link>
  );
}
