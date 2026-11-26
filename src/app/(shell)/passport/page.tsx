'use client';

// ============================================================================
// CAMPUS ORBIT — Campus Passport (§10).
// The student's campus story in stamps and cards: club membership cards with
// scannable verification QRs (§7.6), stamps earned by actually living campus
// life (circles joined, plans attended, events, honours), and nothing
// sensitive — no ID documents, no certificates, no private data, ever.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Award,
  Calendar,
  CalendarClock,
  IdCard,
  Medal,
  ShieldCheck,
  Stamp,
  Trophy,
  Users,
  Users2,
} from 'lucide-react';
import { DEMO_EVENTS } from '@/lib/demo/dataset';
import { isBackendConfigured } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { DemoTag } from '@/components/ui/kit';
import type { ClubMembershipCard } from '@/lib/types';

/* --- Gentle 3D tilt for the physical-card feel (pointer only, never touch) --- */
function TiltCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.classList.add('is-tilting');
    el.style.setProperty('--tilt-x', `${(-py * 9).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(px * 12).toFixed(2)}deg`);
  };

  const onLeave = () => ref.current?.classList.remove('is-tilting');

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={className}>
      {children}
    </div>
  );
}

/* --- Digital membership card (§7.6) with scannable verification QR -------- */
function MembershipCard({ card, origin }: { card: ClubMembershipCard; origin: string | null }) {
  const hasToken = card.verifyToken.trim().length > 0;
  const verifyHref = hasToken ? `/verify/${card.verifyToken}` : null;
  const qrValue = verifyHref ? (origin ? `${origin}${verifyHref}` : verifyHref) : '';

  return (
    <div id={`card-${card.clubSlug}`} className="scroll-mt-24">
      <TiltCard className="tilt-card relative overflow-hidden rounded-3xl bg-[#F7F1E8] p-5 shadow-lift ring-1 ring-black/5">
        <div className="tilt-layer">
          {/* Decorative orbit arc — a Campus Orbit signature on the card itself */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border-[10px] border-violet/20"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-aqua font-display text-sm font-extrabold text-plum">
                {card.clubName.replace(/[^A-Z]/g, '').slice(0, 2) || 'CL'}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-extrabold leading-tight text-plum">{card.clubName}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-plum/70">
                  NUBCONNECT membership card
                </p>
              </div>
            </div>
            {card.isDemo && <DemoTag compact />}
          </div>

          <div className="mt-4">
            <p className="font-display text-lg font-extrabold leading-tight text-plum">{card.personName}</p>
            <p className="text-xs font-semibold text-plum/70">
              {card.role} · member since {card.since}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-plum/70">{card.personDepartment}</p>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-plum/70">
                {hasToken ? 'Scan to verify' : 'Verification pending'}
              </p>
              <p className="text-[10px] leading-snug text-plum/70">
                {hasToken
                  ? 'Opens a public read-only page — no sign-in, no contact details revealed.'
                  : 'A verification token has not been issued for this card yet.'}
              </p>
              {verifyHref && (
                <Link
                  href={verifyHref}
                  className="touch-target mt-1.5 inline-block rounded-lg bg-plum px-2.5 py-1.5 text-[10px] font-bold text-cream"
                >
                  Open verify page
                </Link>
              )}
            </div>
            {hasToken && (
              <span className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-black/10">
                <QRCodeSVG
                  value={qrValue}
                  size={76}
                  bgColor="#FFFFFF"
                  fgColor="#211B35"
                  level="M"
                  marginSize={0}
                  role="img"
                  aria-label={`Verification QR code for ${card.personName}'s ${card.clubName} membership card`}
                />
              </span>
            )}
          </div>
        </div>
      </TiltCard>
    </div>
  );
}

/* --- Passport stamps -------------------------------------------------------- */

type StampKind = 'circle' | 'club' | 'plan' | 'event' | 'honour';

interface PassportStamp {
  id: string;
  title: string;
  detail: string;
  kind: StampKind;
}

const STAMP_ICONS: Record<StampKind, React.ComponentType<{ size?: number | string; className?: string }>> = {
  circle: Users,
  club: Users2,
  plan: CalendarClock,
  event: Calendar,
  honour: Medal,
};

const STAMP_TONES: Record<StampKind, string> = {
  circle: 'bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet',
  club: 'bg-aqua-soft text-aqua-ink dark:bg-aqua/15 dark:text-aqua',
  plan: 'bg-sunshine-soft text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  event: 'bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral',
  honour: 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime',
};

function StampTile({ stamp, index }: { stamp: PassportStamp; index: number }) {
  const Icon = STAMP_ICONS[stamp.kind];
  return (
    <div
      className="card animate-stamp-in flex items-start gap-3 border-2 border-dashed p-3.5"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${STAMP_TONES[stamp.kind]}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-snug">{stamp.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">
          {stamp.detail}
        </p>
      </div>
    </div>
  );
}

/* --- Page -------------------------------------------------------------------- */

export default function PassportPage() {
  const { user, joinedCircles, joinedGroups, joinedClubs, plans, membershipCards, clubs, circles, groups, honours } =
    useApp();
  const configured = isBackendConfigured();
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  /* Stamps are derived from live state — the passport fills as you live campus.
     Names come from the real circle/group directories, never from demo rows. */
  const stamps: PassportStamp[] = joinedCircles
    .map((slug): PassportStamp | null => {
      const c = circles.find((x) => x.slug === slug);
      return c ? { id: `st-c-${slug}`, title: c.name, detail: `Interest circle · ${c.category}`, kind: 'circle' } : null;
    })
    .filter((s): s is PassportStamp => s !== null);

  const groupStamps: PassportStamp[] = joinedGroups
    .map((slug): PassportStamp | null => {
      const g = groups.find((x) => x.slug === slug);
      return g ? { id: `st-g-${slug}`, title: g.name, detail: `${g.type} group`, kind: 'circle' } : null;
    })
    .filter((s): s is PassportStamp => s !== null);

  const clubStamps: PassportStamp[] = joinedClubs
    .map((slug): PassportStamp | null => {
      const c = clubs.find((x) => x.slug === slug);
      return c ? { id: `st-b-${slug}`, title: c.name, detail: `Club member · ${c.category}`, kind: 'club' } : null;
    })
    .filter((s): s is PassportStamp => s !== null);

  const planStamps: PassportStamp[] = plans
    .filter((p) => p.participants.includes(user.id))
    .map((p) => ({
      id: `st-p-${p.id}`,
      title: p.title,
      detail: `Plan · ${p.category} · ${p.spot}`,
      kind: 'plan' as const,
    }));

  // Event registration has no owner-scoped write path in this schema, so a
  // production passport never claims attendance. Demo mode stays labelled.
  const eventStamps: PassportStamp[] = configured
    ? []
    : DEMO_EVENTS.filter((e) => e.registered).map((e) => ({
        id: `st-e-${e.id}`,
        title: e.title,
        detail: `Registered · ${e.date}`,
        kind: 'event' as const,
      }));

  const honourStamps: PassportStamp[] = honours
    .filter((e) => e.personId === user.id)
    .map((e) => ({
      id: `st-h-${e.id}`,
      title: e.title,
      detail: `Campus Honour · ${e.category} · +${e.points} pts · ${e.semester}`,
      kind: 'honour' as const,
    }));

  const allStamps = [...stamps, ...groupStamps, ...clubStamps, ...planStamps, ...eventStamps, ...honourStamps];

  const myHonourPoints = honours
    .filter((e) => e.personId === user.id)
    .reduce((sum, e) => sum + e.points, 0);

  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="flex items-center gap-2 font-display text-xl font-extrabold sm:text-2xl">
          <Stamp size={22} className="text-violet-ink" /> Campus Passport
        </h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          Your campus story — stamps and cards you earned by being here. No documents, no IDs, nothing sensitive.
        </p>
      </header>

      {/* Membership cards (Club Universe §7.6) */}
      <section aria-labelledby="passport-cards-h">
        <h2 id="passport-cards-h" className="mb-2 flex items-center gap-1.5 px-1 font-display text-sm font-bold">
          <IdCard size={15} className="text-violet-ink" /> Membership cards
        </h2>
        {membershipCards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {membershipCards.map((card) => (
              <MembershipCard key={card.id} card={card} origin={origin} />
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center">
            <IdCard
              size={22}
              className="mx-auto text-campus-text-sec dark:text-campus-dark-sec"
            />
            <p className="mt-2 font-display font-bold">No membership cards yet</p>
            <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
              Apply to a club from the Club Universe. Once a representative approves your membership,
              a verifiable card appears here.
            </p>
            <Link
              href="/circle?tab=clubs"
              className="touch-target mt-3 inline-block rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum shadow-violet-glow"
            >
              Explore clubs
            </Link>
          </div>
        )}
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          Cards are issued by your clubs. The QR opens a public, read-only verification page — it never reveals your
          contact details or opens a chat.
        </p>
      </section>

      {/* Stamps */}
      <section aria-labelledby="passport-stamps-h">
        <h2 id="passport-stamps-h" className="mb-2 flex items-center gap-1.5 px-1 font-display text-sm font-bold">
          <Award size={15} className="text-violet-ink" /> Passport stamps
          <span className="ml-1 rounded-full bg-violet-soft px-2 py-0.5 font-mono text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
            {allStamps.length}
          </span>
        </h2>
        {allStamps.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 overflow-x-clip sm:grid-cols-2">
            {allStamps.map((s, i) => (
              <StampTile key={s.id} stamp={s} index={i} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="font-display font-bold">Your passport is still blank</p>
            <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
              {configured
                ? 'Join circles or groups and contribute to clubs — stamps collect themselves as you take part.'
                : 'Join a circle, attend an event or make a plan — stamps collect themselves as you live campus life.'}
            </p>
          </div>
        )}
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          {configured
            ? 'Stamps come from real memberships and recognition records — never from likes or followers. Event attendance and local plans are not linked to the passport in this release.'
            : 'Stamps come from what you actually do on campus — never from likes or followers. Club membership and Campus Honours are real when you are signed in; circle, plan and event stamps are demo data.'}
        </p>
      </section>

      {/* Honours */}
      <section aria-labelledby="passport-honours-h" className="card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime">
            <Trophy size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="passport-honours-h" className="font-display text-sm font-bold">
              Campus Honours
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {myHonourPoints > 0
                ? `You hold ${myHonourPoints} verified contribution point${myHonourPoints === 1 ? '' : 's'}.`
                : 'Recognition for real contributions — mentoring, organizing, showing up.'}
            </p>
          </div>
          <Link
            href="/honours"
            className="touch-target shrink-0 rounded-xl bg-violet px-3.5 py-2 text-[11px] font-bold text-plum"
          >
            View honours
          </Link>
        </div>
      </section>

      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-violet-ink" />
        Your passport holds only campus activity — never ID documents, certificates or anything sensitive. It stays
        on your account and is never shared publicly.
      </p>
    </div>
  );
}
