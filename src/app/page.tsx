import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Home,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Users2,
  Wifi,
} from 'lucide-react';
import { NUB_CLUBS, NUB_DEPARTMENTS, ROSTER_SOURCE } from '@/lib/institutionalRoster';
import { REAL_EVENTS } from '@/lib/nubEvents';

export const metadata: Metadata = {
  title: 'NUBCONNECT — The campus community of Northern University Bangladesh',
  description:
    'The social network for Northern University Bangladesh students: departments, clubs, Circles, rooms and roommates, the student marketplace, messenger and Campus Passport — public to explore before you sign up.',
};

const FEATURES = [
  {
    icon: Building2,
    title: 'Your department',
    body: 'Every verified NUB department has a community page — spotlights, announcements and the students who study there.',
    next: '/department',
  },
  {
    icon: Users2,
    title: '27 official clubs',
    body: 'Technology, arts, sports, debate, service and more — the Student Affairs roster, each club managed by its committee.',
    next: '/circle?tab=clubs',
  },
  {
    icon: Sparkles,
    title: 'Circles & communities',
    body: 'Find the people on your wavelength — interest circles, course groups and study partners created by students.',
    next: '/circle',
  },
  {
    icon: Home,
    title: 'Rooms & roommates',
    body: 'Flats, shared rooms, hostel seats and mess places near campus — addresses stay private; enquiries go through the platform.',
    next: '/roommates',
  },
  {
    icon: Store,
    title: 'Student marketplace',
    body: 'Buy and sell books, electronics, furniture and gear with students — real prices in ৳, real photographs.',
    next: '/marketplace',
  },
  {
    icon: MessageCircle,
    title: 'Messenger & trust',
    body: 'Private one-to-one chat with message requests for people you do not know. Verification is separate from sign-in.',
    next: '/messages',
  },
] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* --- Public header ------------------------------------------------ */}
      <header className="sticky top-0 z-20 border-b border-campus-border/60 bg-campus-bg/85 backdrop-blur-md dark:border-campus-dark-border/60 dark:bg-campus-dark-bg/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-baseline gap-1.5 font-display text-lg font-extrabold tracking-tight">
            <span>NUB</span>
            <span className="text-violet-ink dark:text-violet">CONNECT</span>
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-1.5 text-xs font-bold sm:gap-2">
            <a href="#events" className="rounded-xl px-2.5 py-2 text-campus-text-sec transition hover:bg-black/5 hover:text-campus-text dark:text-campus-dark-sec dark:hover:bg-white/10 dark:hover:text-campus-dark-text">
              Official events
            </a>
            <a href="#roster" className="rounded-xl px-2.5 py-2 text-campus-text-sec transition hover:bg-black/5 hover:text-campus-text dark:text-campus-dark-sec dark:hover:bg-white/10 dark:hover:text-campus-dark-text">
              Departments
            </a>
            <Link
              href="/auth/login"
              className="rounded-xl px-2.5 py-2 text-campus-text-sec transition hover:bg-black/5 hover:text-campus-text dark:text-campus-dark-sec dark:hover:bg-white/10 dark:hover:text-campus-dark-text"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="btn-press rounded-xl bg-violet px-3 py-2 text-plum shadow-violet-glow"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      {/* --- Hero --------------------------------------------------------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-8 sm:px-6 md:grid-cols-2 md:gap-10 md:pb-16 md:pt-14">
        <div className="space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-violet-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
            <ShieldCheck size={13} /> Northern University Bangladesh
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-[3.35rem]">
            Meet the campus.<br />Live the campus.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            NUBCONNECT is the student network of Northern University Bangladesh — your department,
            your clubs, your Circles, your rooms, your marketplace and the news of your campus,
            in one place. Explore it before you ever sign in.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/auth/register"
              className="btn-press flex items-center gap-1.5 rounded-2xl bg-violet px-5 py-3 text-sm font-bold text-plum shadow-violet-glow"
            >
              Create your account <ArrowRight size={16} />
            </Link>
            <Link
              href="/auth/login"
              className="rounded-2xl bg-campus-card px-5 py-3 text-sm font-bold ring-1 ring-campus-border transition hover:ring-violet dark:bg-campus-dark-card dark:ring-campus-dark-border"
            >
              Sign in
            </Link>
          </div>
          <p className="max-w-md text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Everything official is published by a verified NUB Connect page; everything else is
            published by a real student under their own name. An account alone does not make anyone
            a verified NUB student — verification is a separate review.
          </p>
        </div>
        <figure className="relative overflow-hidden rounded-5xl shadow-lift">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/nub/campus-permanent-1.jpg"
            alt="Permanent campus of Northern University Bangladesh"
            className="h-64 w-full object-cover sm:h-80 md:h-[28rem]"
          />
          <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-[11px] font-semibold text-white/90">
            Permanent Campus — official NUB gallery (<a href="https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus" className="underline" target="_blank" rel="noopener noreferrer">nub.ac.bd</a>, used with attribution)
          </figcaption>
        </figure>
      </section>

      {/* --- What you can do -------------------------------------------- */}
      <section aria-labelledby="explore-h" className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="explore-h" className="font-display text-xl font-extrabold">What you can do here</h2>
            <p className="text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">Sign in to explore each space — you will land right where you meant to go.</p>
          </div>
          <Link href="/auth/register" className="text-xs font-bold text-violet-ink hover:underline dark:text-violet">
            Get started →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={`/auth/login?next=${encodeURIComponent(f.next)}`}
              className="hover-lift group rounded-3xl border border-campus-border bg-campus-card p-4 shadow-soft transition dark:border-campus-dark-border dark:bg-campus-dark-card"
            >
              <f.icon size={20} className="text-violet-ink dark:text-violet" aria-hidden="true" />
              <h3 className="mt-2 font-display text-sm font-bold">{f.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{f.body}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-violet-ink dark:text-violet">
                Sign in to explore <ArrowRight size={11} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* --- Official events (verbatim from nub.ac.bd) -------------------- */}
      <section id="events" aria-labelledby="official-events-h" className="border-y border-campus-border/60 bg-campus-card/60 py-10 dark:border-campus-dark-border/60 dark:bg-campus-dark-card/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 id="official-events-h" className="flex items-center gap-2 font-display text-xl font-extrabold"><CalendarDays size={19} className="text-violet-ink dark:text-violet" /> Official — from nub.ac.bd</h2>
              <p className="text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">The published NUB events feed (Feb–Jul 2026). Titles preserved verbatim; each links to the original article.</p>
            </div>
            <a href="https://nub.ac.bd/nub/events" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-ink hover:underline dark:text-violet">
              View source feed <ExternalLink size={11} />
            </a>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {REAL_EVENTS.map((e) => (
              <li key={e.id}>
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full items-start gap-3 rounded-2xl border border-campus-border bg-campus-card p-3 transition hover:ring-1 hover:ring-violet dark:border-campus-dark-border dark:bg-campus-dark-card"
                >
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-aqua-soft dark:bg-aqua/10">
                    <span className="font-mono text-[9px] font-bold uppercase text-aqua-ink dark:text-aqua">
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="font-display text-base font-extrabold leading-none text-aqua-ink dark:text-aqua">
                      {new Date(e.date + 'T00:00:00').getDate()}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold leading-snug">{e.title}</span>
                    <span className="mt-1 block text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      nub.ac.bd — Official
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --- Verified roster ---------------------------------------------- */}
      <section id="roster" aria-labelledby="roster-h" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-4">
          <h2 id="roster-h" className="flex items-center gap-2 font-display text-xl font-extrabold"><GraduationCap size={19} className="text-violet-ink dark:text-violet" /> The verified roster</h2>
          <p className="text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            {NUB_DEPARTMENTS.length} departments and {NUB_CLUBS.length} clubs, exactly as published — source: {ROSTER_SOURCE.label} (<a className="underline" href={ROSTER_SOURCE.href} target="_blank" rel="noopener noreferrer">nub.ac.bd</a>).
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-campus-text-sec dark:text-campus-dark-sec"><BookOpen size={13} /> Departments</h3>
            <ul className="divide-y divide-campus-border overflow-hidden rounded-2xl border border-campus-border dark:divide-campus-dark-border dark:border-campus-dark-border">
              {NUB_DEPARTMENTS.map((d) => (
                <li key={d.code} className="flex items-baseline justify-between gap-3 bg-campus-card px-3 py-2 dark:bg-campus-dark-card">
                  <span className="text-[12px] font-semibold">{d.name}</span>
                  <span className="shrink-0 font-mono text-[9px] font-bold text-campus-text-sec dark:text-campus-dark-sec">{d.semester === 'Tri-Semester' ? 'TRI' : 'BI'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-campus-text-sec dark:text-campus-dark-sec"><Megaphone size={13} /> Clubs & societies</h3>
            <ul className="flex flex-wrap gap-1.5">
              {NUB_CLUBS.map((c) => (
                <li key={c.name} className="rounded-full border border-campus-border bg-campus-card px-3 py-1.5 text-[11px] font-semibold dark:border-campus-dark-border dark:bg-campus-dark-card" title={c.category}>
                  {c.name}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Each club is managed by its own elected committee. Official spotlights and posts from these organizations
              appear on NUBCONNECT under their verified pages.
            </p>
          </div>
        </div>
      </section>

      {/* --- How sign-in works -------------------------------------------- */}
      <section aria-labelledby="how-h" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="rounded-4xl bg-plum p-6 text-[#F5F1FA] sm:p-8">
          <h2 id="how-h" className="flex items-center gap-2 font-display text-lg font-extrabold"><Wifi size={18} /> How sign-in works</h2>
          <ol className="mt-3 grid gap-4 text-[12px] leading-relaxed text-violet-100 sm:grid-cols-3">
            <li><span className="font-mono font-bold text-lime">1.</span> Create an account with your university or personal email — or Google, when enabled on this deployment.</li>
            <li><span className="font-mono font-bold text-lime">2.</span> Confirm your email if the deployment asks for it. Verification is a separate review by university staff.</li>
            <li><span className="font-mono font-bold text-lime">3.</span> Land exactly where you were headed — your department, a club, a room listing or the marketplace.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/auth/register" className="btn-press rounded-2xl bg-violet px-5 py-3 text-sm font-bold text-plum">Create your account</Link>
            <Link href="/auth/login" className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-bold text-violet-100 transition hover:bg-white/10">Sign in</Link>
          </div>
        </div>
      </section>

      {/* --- Footer -------------------------------------------------------- */}
      <footer className="border-t border-campus-border/60 dark:border-campus-dark-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec sm:px-6">
          <p>© {new Date().getFullYear()} NUBCONNECT — Northern University Bangladesh</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-campus-text dark:hover:text-campus-dark-text">Privacy</Link>
            <Link href="/help" className="hover:text-campus-text dark:hover:text-campus-dark-text">Help & FAQ</Link>
            <Link href="/auth/login?next=/more" className="hover:text-campus-text dark:hover:text-campus-dark-text">Explore (sign in)</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
