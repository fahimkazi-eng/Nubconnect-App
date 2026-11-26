'use client';

// ============================================================================
// HOME RAIL — the wide-desktop editorial columns.
// Left: personal desk (shortcuts and genuine user context).
// Right: contextual campus material — official events and real circles.
// On smaller screens these components are stacked or hidden by the page.
// ============================================================================

import Link from 'next/link';
import { CalendarDays, ChevronRight, Compass, GraduationCap, Home, Store, Trophy, Users } from 'lucide-react';
import { useApp } from '@/lib/store';
import { REAL_EVENTS } from '@/lib/nubEvents';

const SHORTCUTS = [
  { href: '/pulse', label: 'Campus Pulse', icon: Compass, note: 'Who is around' },
  { href: '/events', label: 'Events', icon: CalendarDays, note: 'Official & campus' },
  { href: '/academic', label: 'Academic Hub', icon: GraduationCap, note: 'Tools & calendar' },
  { href: '/roommates', label: 'Room', icon: Home, note: 'Rooms & flatmates' },
  { href: '/marketplace', label: 'Market', icon: Store, note: 'Buy & sell' },
  { href: '/honours', label: 'Campus Honours', icon: Trophy, note: 'Contributions' },
];

export function HomeDesk() {
  const { user, isDemoUser, availability, activities } = useApp();

  return (
    <aside aria-label="Your campus desk" className="space-y-4">
      <div className="card p-4">
        <p className="editorial-kicker text-violet-ink dark:text-violet">Your desk</p>
        {!isDemoUser && (
          <div className="mt-3 border-b border-campus-border pb-3 dark:border-campus-dark-border">
            <p className="font-display text-sm font-extrabold">{user.name}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              {[user.departmentCode, user.semester].filter(Boolean).join(' · ') || 'NUB CONNECT member'}
            </p>
          </div>
        )}
        <nav className="mt-2 space-y-0.5">
          {SHORTCUTS.map(({ href, label, icon: Icon, note }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-campus-bg dark:hover:bg-campus-dark-elev"
            >
              <Icon size={15} className="shrink-0 text-violet-ink dark:text-violet" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold">{label}</span>
                <span className="block truncate text-[10px] text-campus-text-sec dark:text-campus-dark-sec">{note}</span>
              </span>
              <ChevronRight size={12} className="shrink-0 opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </nav>
      </div>

      <div className="rounded-[20px] bg-editorial-ink p-4 text-editorial-ivory dark:bg-editorial-surface">
        <p className="editorial-kicker text-editorial-lime">Live right now</p>
        <p className="mt-3 font-display text-2xl font-extrabold tabular-nums">{availability.length}</p>
        <p className="text-[11px] font-semibold text-editorial-ivory/70">live availability statuses</p>
        <div className="editorial-rule my-3 text-editorial-ivory" />
        <p className="font-display text-lg font-extrabold tabular-nums">{activities.length}</p>
        <p className="text-[11px] font-semibold text-editorial-ivory/70">open campus activities</p>
        <p className="mt-3 text-[10px] leading-relaxed text-editorial-ivory/55">
          All opt-in, all expiring. Being online never means being on campus.
        </p>
      </div>
    </aside>
  );
}

export function HomeEventsRail() {
  const { circles } = useApp();
  const featured = REAL_EVENTS.slice(0, 2);
  const realCircles = circles.filter((c) => !c.isDemo).slice(0, 3);

  return (
    <aside aria-label="Campus activity" className="space-y-4">
      <section className="card overflow-hidden p-0">
        <div className="flex items-end justify-between px-4 pb-2 pt-4">
          <div>
            <p className="editorial-kicker text-violet-ink dark:text-violet">From nub.ac.bd</p>
            <h2 className="mt-1 font-display text-base font-extrabold">Official events</h2>
          </div>
          <Link href="/events" className="flex items-center text-[11px] font-bold text-violet-ink hover:underline dark:text-violet">
            All <ChevronRight size={12} />
          </Link>
        </div>
        <div className="space-y-2 px-4 pb-4">
          {featured.map((event) => (
            <a
              key={event.id}
              href={event.sourceUrl || '/events'}
              target={event.sourceUrl ? '_blank' : undefined}
              rel={event.sourceUrl ? 'noopener noreferrer' : undefined}
              className="block rounded-xl border border-campus-border p-3 transition hover:border-violet/40 dark:border-campus-dark-border"
            >
              <p className="line-clamp-2 font-display text-xs font-bold leading-snug">{event.title}</p>
              <p className="mt-1 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                {event.date} · {event.originLabel}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-extrabold">
            <Users size={15} className="text-violet-ink dark:text-violet" /> Suggested circles
          </h2>
          <Link href="/circle" className="text-[11px] font-bold text-violet-ink hover:underline dark:text-violet">
            Explore
          </Link>
        </div>
        {realCircles.length === 0 ? (
          <p className="mt-3 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            No circles have been published on this campus yet. You can discover clubs and communities in Circle.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {realCircles.map((circle) => (
              <Link
                key={circle.slug}
                href={`/circles/${circle.slug}`}
                className="flex items-center gap-2.5 rounded-xl bg-campus-bg p-2 transition hover:bg-violet-soft dark:bg-campus-dark-elev dark:hover:bg-violet-dark-soft"
              >
                {circle.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={circle.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                    <Users size={15} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{circle.name}</span>
                  <span className="block truncate text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                    {circle.memberCount > 0 ? `${circle.memberCount} members` : 'Community'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
