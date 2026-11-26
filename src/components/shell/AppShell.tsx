'use client';

// ============================================================================
// NUBCONNECT — Responsive application shell (CAMPUS ORBIT edition).
//  Desktop  : glass left sidebar (profile, 6 primary destinations, pins,
//             explore, settings) + centered content + contextual right rail.
//  Mobile   : logo-only compact header + safe-area dock with all SIX
//             destinations directly reachable — Home, Circle, Chats, Room,
//             Marketplace, More (More is a first-level page, not a sheet).
// ============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BedDouble,
  Check,
  ChevronRight,
  Home,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Moon,
  Orbit,
  Store,
  Sun,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { PIN_CATALOG, PRIMARY_DESTINATIONS, pinDef } from '@/lib/nav';
import { Avatar, Modal, useHotkey } from '@/components/ui/kit';
import { PIN_ICONS as ICONS } from '@/components/ui/pinIcons';
import { isBackendConfigured } from '@/lib/supabase';

/* --- Logo ------------------------------------------------------------------ */
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {/* Brand mark: rendered as SVG so the link's visible text is exactly the
          wordmark (WCAG 2.5.3 Label in Name). Same geometry as the PWA icon. */}
      <svg
        viewBox="0 0 512 512"
        aria-hidden
        focusable="false"
        className="h-8 w-8 select-none rounded-xl shadow-violet-glow"
      >
        <defs>
          <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#927CFA" />
            <stop offset="1" stopColor="#72DCCB" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="112" fill="url(#logoBg)" />
        <g fill="#FFFFFF">
          <rect x="136" y="136" width="52" height="240" rx="16" />
          <rect x="324" y="136" width="52" height="240" rx="16" />
          <polygon points="188,136 376,336 376,376 188,176" />
          <polygon points="188,336 188,376 376,176 376,136" />
        </g>
      </svg>
      {!compact && (
        <span className="font-display text-[17px] font-extrabold tracking-tight">
          NUB<span className="text-violet-ink">CONNECT</span>
        </span>
      )}
    </span>
  );
}

/* --- Onboarding ------------------------------------------------------------- */
function Onboarding() {
  const { onboarded, finishOnboarding, user, setPrivacy, pushToast, authLoading } = useApp();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const INTERESTS = ['Technology', 'Photography', 'Sports', 'Music', 'Reading', 'Entrepreneurship', 'Gaming', 'Volunteering'];

  // Never greet a student before we know who they are: while the session is
  // restoring, `user` is still the local demo profile (a different name).
  if (onboarded || authLoading) return null;

  const steps = [
    {
      title: `Welcome to NUBCONNECT, ${user.name.split(' ')[0]}!`,
      body: isBackendConfigured()
        ? 'Meet people. Find your circle. Live your campus. Everything here is published by a real student or a verified page.'
        : 'Meet people. Find your circle. Live your campus. Everything you see while your university backend is not connected is clearly labelled DEMO.',
      action: null,
    },
    {
      title: 'What are you into?',
      body: 'Pick a few interests — we use them to suggest circles and people. You can change these anytime.',
      action: (
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interests.includes(i)}
              onClick={() => setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
                interests.includes(i)
                  ? 'bg-violet text-plum ring-violet'
                  : 'bg-campus-card text-campus-text-sec ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Your privacy, your rules',
      body: 'Choose who can discover you. You can always adjust this later in Settings.',
      action: (
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-2 rounded-xl bg-campus-bg p-3 text-left text-xs ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
            <input
              type="radio"
              name="ob-disc"
              defaultChecked
              onChange={() => setPrivacy({ discoverability: 'University Students Only' })}
              className="mt-0.5 accent-violet"
            />
            <span>
              <strong>University students only</strong>
              <span className="block text-campus-text-sec dark:text-campus-dark-sec">
                Recommended — only verified NUB students can find you.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-xl bg-campus-bg p-3 text-left text-xs ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
            <input
              type="radio"
              name="ob-disc"
              onChange={() => setPrivacy({ discoverability: 'Verified Students Only' })}
              className="mt-0.5 accent-violet"
            />
            <span>
              <strong>Verified students only</strong>
              <span className="block text-campus-text-sec dark:text-campus-dark-sec">
                Only students who completed university verification.
              </span>
            </span>
          </label>
        </div>
      ),
    },
    {
      title: 'Make it yours',
      body: 'Department, Academic, Events, Lost & Found and more live in the More destination — pin your favourites from More → My Pins. Ready to explore?',
      action: null,
    },
  ];

  const s = steps[step]!;

  return (
    <Modal open onClose={finishOnboarding} title="NUBCONNECT">
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-violet' : 'bg-campus-border dark:bg-campus-dark-border'}`} />
          ))}
        </div>
        <h2 className="font-display text-xl font-extrabold">{s.title}</h2>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">{s.body}</p>
        {s.action}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={finishOnboarding}
            className="text-xs font-semibold text-campus-text-sec underline-offset-2 hover:underline dark:text-campus-dark-sec"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="touch-target rounded-xl bg-campus-bg px-4 font-semibold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (step === steps.length - 1) {
                  finishOnboarding();
                  pushToast(interests.length > 0 ? `Great! Following up on ${interests.length} interests` : 'Welcome aboard!', 'success');
                } else setStep(step + 1);
              }}
              className="touch-target flex items-center gap-1.5 rounded-xl bg-violet px-4 font-semibold text-plum shadow-violet-glow"
            >
              {step === steps.length - 1 ? <Check size={16} /> : null}
              {step === steps.length - 1 ? 'Start exploring' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* --- Toasts host ------------------------------------------------------------ */
function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`glass-strong animate-fade-up max-w-sm rounded-full px-4 py-2 text-[13px] font-semibold ${
            t.tone === 'success'
              ? 'text-lime-ink dark:text-lime'
              : t.tone === 'warning'
                ? 'text-coral'
                : 'text-campus-text dark:text-campus-dark-text'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* --- Sidebar (desktop) ------------------------------------------------------- */
function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, pins, unreadCount, unreadNotificationCount, theme, toggleTheme, isDemoUser, signOut } = useApp();

  const destIcons = [Home, Orbit, MessageCircle, BedDouble, Store, LayoutGrid];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="glass sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto rounded-none border-y-0 border-l-0 px-3 py-4 lg:flex">
      <div className="mb-4 px-2">
        <Link href="/home" className="touch-target flex items-center" aria-label="NUBCONNECT home">
          <Logo />
        </Link>
        <p className="editorial-kicker mt-1 pl-10 text-campus-text-sec dark:text-campus-dark-sec">
          Campus Edition
        </p>
      </div>

      {/* Profile */}
      <Link href={`/profile/${user.username}`} className="mb-3 flex items-center gap-3 rounded-2xl p-2 transition hover:bg-violet-soft dark:hover:bg-violet-dark-soft">
        <Avatar seed={user.id} name={user.name} size={40} src={user.avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-bold">{user.name}</span>
          <span className="block truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            {user.departmentCode} • {user.semester}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
      </Link>

      {/* Six primary destinations */}
      <nav aria-label="Primary" className="space-y-0.5">
        {PRIMARY_DESTINATIONS.map((d, i) => {
          const Icon = destIcons[i]!;
          const active = isActive(d.href);
          // Lighthouse SEO reads link text, not aria-label. Keep the compact
          // visible word while making the anchor's text descriptive too.
          const srSuffix = d.ariaLabel.startsWith(d.label)
            ? d.ariaLabel.slice(d.label.length).trim()
            : '';
          return (
            <Link
              key={d.key}
              href={d.href}
              aria-label={d.ariaLabel}
              aria-current={active ? 'page' : undefined}
              className={`touch-target relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-violet text-plum shadow-violet-glow' : 'hover:bg-violet-soft dark:hover:bg-violet-dark-soft'
              }`}
            >
              <Icon size={19} />
              <span className="flex-1 truncate">
                {d.label}
                {srSuffix && <span className="sr-only"> {srSuffix}</span>}
              </span>
              {d.key === 'messages' && unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-ink px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
              {active && <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-editorial-lime" />}
            </Link>
          );
        })}
      </nav>

      {/* My Pins */}
      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between px-3">
          <span className="editorial-kicker text-campus-text-sec dark:text-campus-dark-sec">
            My Pins
          </span>
          <Link href="/more#pins" className="text-[11px] font-semibold text-violet-ink hover:underline">
            Edit
          </Link>
        </div>
        <div className="space-y-0.5">
          {pins.map((k) => {
            const def = pinDef(k);
            const Icon = ICONS[def.icon] ?? LayoutGrid;
            const active = isActive(def.href);
            return (
              <Link
                key={k}
                href={def.href}
                className={`touch-target flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-violet-soft font-semibold text-violet-ink dark:bg-violet-dark-soft dark:text-violet' : 'hover:bg-violet-soft dark:hover:bg-violet-dark-soft'
                }`}
              >
                <Icon size={17} />
                <span className="flex-1 truncate">{def.label}</span>
                {k === 'notifications' && unreadNotificationCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-coral" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Explore (always available) */}
      <div className="mt-5">
        <span className="editorial-kicker mb-1 block px-3 text-campus-text-sec dark:text-campus-dark-sec">
          Explore
        </span>
        <div className="space-y-0.5">
          {PIN_CATALOG.filter((p) => !pins.includes(p.key)).map((p) => {
            const Icon = ICONS[p.icon] ?? LayoutGrid;
            return (
              <Link
                key={p.key}
                href={p.href}
                className="touch-target flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-campus-text-sec transition hover:bg-violet-soft dark:text-campus-dark-sec dark:hover:bg-violet-dark-soft"
              >
                <Icon size={17} />
                <span className="flex-1 truncate">{p.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto space-y-1 pt-4">
        <button
          onClick={toggleTheme}
          className="touch-target flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {!isDemoUser && (
          <button
            onClick={async () => {
              await signOut();
              router.replace('/auth/login');
              router.refresh();
            }}
            className="touch-target flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
          >
            Sign out
          </button>
        )}
        {!isBackendConfigured() && (
          <p className="rounded-xl bg-sunshine-soft p-2.5 text-[10px] font-semibold leading-relaxed text-amber-700 ring-1 ring-amber-300/50 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30">
            DEMO MODE — sample content. Connect your university Supabase in Settings to go live.
          </p>
        )}
      </div>
    </aside>
  );
}

/* --- Mobile header (logo ONLY, per product decision §2.2) ------------------- */
function MobileHeader() {
  return (
    <header className="glass safe-top fixed inset-x-0 top-0 z-40 flex h-[52px] items-center justify-center border-x-0 border-t-0 px-4 lg:hidden">
      <Link href="/home" aria-label="NUBCONNECT home">
        <Logo />
      </Link>
    </header>
  );
}

/* --- Bottom navigation (mobile): all six destinations, no sheet ------------- */
function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount } = useApp();

  useHotkey('k', () => router.push('/search'));

  // Six tabs keep comfortable ~53px targets at 320px. Compact labels; the
  // active tab's label is emphasized (weight + accent color).
  const items = [
    { href: '/home', label: 'Home', ariaLabel: 'Home dashboard', icon: Home },
    { href: '/circle', label: 'Circle', ariaLabel: 'Circle communities', icon: Orbit },
    { href: '/messages', label: 'Chats', ariaLabel: 'Chats and messages', icon: MessageCircle, badge: unreadCount },
    { href: '/roommates', label: 'Room', ariaLabel: 'Room and roommates', icon: BedDouble },
    { href: '/marketplace', label: 'Market', ariaLabel: 'Marketplace listings', icon: Store },
    { href: '/more', label: 'More', ariaLabel: 'More destinations', icon: LayoutGrid },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="Primary"
      className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-stretch border-x-0 border-b-0 lg:hidden"
    >
      {items.map((it) => {
        const Icon = it.icon;
        const active = isActive(it.href);
        const srSuffix = it.ariaLabel.startsWith(it.label)
          ? it.ariaLabel.slice(it.label.length).trim()
          : '';
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-label={it.ariaLabel}
            aria-current={active ? 'page' : undefined}
            className="relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1"
          >
            <span className="relative">
              <Icon size={21} strokeWidth={active ? 2.4 : 2} className={active ? 'text-plum dark:text-violet' : 'text-campus-text-sec dark:text-campus-dark-sec'} />
              {it.badge != null && it.badge > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-ink px-1 text-[9px] font-bold text-white">
                  {it.badge > 9 ? '9+' : it.badge}
                </span>
              )}
            </span>
            <span className={`text-[10px] ${active ? 'font-extrabold text-plum dark:text-violet' : 'font-semibold text-campus-text-sec dark:text-campus-dark-sec'}`}>
              {it.label}
              {srSuffix && <span className="sr-only"> {srSuffix}</span>}
            </span>
            <span
              className={`absolute top-0 h-[3px] rounded-b-full bg-editorial-lime transition-all ${active ? 'w-8 opacity-100' : 'w-0 opacity-0'}`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

/* --- Right rail (context-aware, desktop only) ---------------------------------- */
function RightRail() {
  const pathname = usePathname();
  const { joinedCircles, saved } = useApp();
  if (pathname.startsWith('/messages') || pathname.startsWith('/settings')) return null;

  const isMarket = pathname.startsWith('/marketplace');
  const isRooms = pathname.startsWith('/roommates');

  return (
    <aside className="sticky top-4 hidden w-[300px] shrink-0 space-y-4 self-start py-4 pr-4 xl:block">
      {isRooms ? (
        <div className="card p-4">
          <h3 className="mb-2 font-display text-sm font-bold">Saved rooms</h3>
          <p className="text-xs text-campus-text-sec dark:text-campus-dark-sec">
            You have {saved.rooms.length} saved {saved.rooms.length === 1 ? 'room' : 'rooms'}.
          </p>
          <Link href="/saved" className="mt-2 inline-block text-xs font-semibold text-violet-ink hover:underline">
            Open Saved →
          </Link>
        </div>
      ) : isMarket ? (
        <div className="card p-4">
          <h3 className="mb-2 font-display text-sm font-bold">Sell on Marketplace</h3>
          <p className="text-xs text-campus-text-sec dark:text-campus-dark-sec">
            Books you finished, gear you outgrew — list it for your campus.
          </p>
          <Link
            href="/marketplace/new"
            className="mt-2 inline-block rounded-xl bg-violet px-3.5 py-2 text-xs font-bold text-plum shadow-violet-glow"
          >
            + Create listing
          </Link>
        </div>
      ) : (
        <>
          <div className="card p-4">
            <h3 className="mb-2 font-display text-sm font-bold">Your circles</h3>
            <p className="text-xs text-campus-text-sec dark:text-campus-dark-sec">
              You joined {joinedCircles.length} {joinedCircles.length === 1 ? 'circle' : 'circles'}.
            </p>
            <Link href="/circle?tab=circles" className="mt-2 inline-block text-xs font-semibold text-violet-ink hover:underline">
              Browse circles →
            </Link>
          </div>
          <div className="card p-4">
            <h3 className="mb-2 font-display text-sm font-bold">Happening on campus</h3>
            <p className="text-xs text-campus-text-sec dark:text-campus-dark-sec">
              Debate finale Friday • Skill Tracks Week 3 • Clean-up drive Saturday
            </p>
            <Link href="/events" className="mt-2 inline-block text-xs font-semibold text-violet-ink hover:underline">
              All events →
            </Link>
          </div>
        </>
      )}
      <div className="card p-4">
        <h3 className="mb-1 font-display text-sm font-bold">About this experience</h3>
        <p className="text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          NUBCONNECT for Northern University Bangladesh. Photos only — no video. Follow people, join circles, message with consent.
          {!isBackendConfigured() && ' Currently showing clearly-labelled DEMO content.'}
        </p>
      </div>
    </aside>
  );
}

/* --- Platform announcement ---------------------------------------------------
   Written only by a Super Admin through `admin_set_announcement()`. When the
   backend has no announcement the banner simply does not exist — the app never
   invents one. */
function PlatformAnnouncement() {
  const { platformFlags } = useApp();
  if (!platformFlags.announcement) return null;
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-xl bg-violet-soft px-3 py-2.5 text-violet-ink ring-1 ring-violet/25 dark:bg-violet-dark-soft"
    >
      <Megaphone size={15} className="mt-0.5 shrink-0" />
      <p className="text-[12px] font-semibold leading-relaxed">{platformFlags.announcement.message}</p>
    </div>
  );
}

/* --- The shell ------------------------------------------------------------------ */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Home is the only route with an editorial three-column composition; it
  // needs more room on very wide displays. Everywhere else stays a focused
  // 680px reading column.
  const isHome = pathname === '/home';

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 justify-center">
        <main
          className={`pt-safe-header w-full px-3 pb-[calc(env(safe-area-inset-bottom,0px)+76px)] pt-3 sm:px-4 lg:pt-6 lg:pb-10 ${
            isHome ? 'max-w-[680px] 2xl:max-w-[980px]' : 'max-w-[680px]'
          }`}
        >
          <PlatformAnnouncement />
          {children}
        </main>
      </div>
      <RightRail />
      <MobileHeader />
      <BottomNav />
      <Onboarding />
      <Toasts />
    </div>
  );
}
