'use client';

// ============================================================================
// CAMPUS ORBIT — public membership card verification (§7.6) — client half.
// Scanned from a club membership card QR. Read-only and safe by design:
// it confirms the card is genuine and shows ONLY what is printed on the card
// — no contact details, no messaging, no extra profile data.
//
// With a real backend the lookup goes through the public, read-only
// get_membership_card RPC. Demo cards are used only when no backend is
// configured — never as a fallback that could pretend a real card is genuine.
// ============================================================================
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { DEMO_CLUBS, DEMO_MEMBERSHIP_CARDS } from '@/lib/demo/dataset';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { loadMembershipCard, type PublicMembershipCard } from '@/lib/clubs';

interface CardView {
  clubSlug: string;
  clubName: string;
  personName: string;
  personDepartment: string;
  role: string;
  since: string;
  status: string;
  isDemo: boolean;
}

export default function VerifyCardClient({ token }: { token: string }) {
  const backendConfigured = isBackendConfigured();

  const [realCard, setRealCard] = useState<PublicMembershipCard | null>(null);
  const [loading, setLoading] = useState(backendConfigured);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!backendConfigured) {
      setLoading(false);
      setError(null);
      setRealCard(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      setError('Verification is not configured for this deployment.');
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    void loadMembershipCard(supabase, token).then((result) => {
      if (!active) return;
      setRealCard(result.card);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [backendConfigured, token, attempt]);

  // A verification link is public: any demo card token resolves in demo mode,
  // not just cards belonging to the browser's current local demo account.
  const demoCard = !backendConfigured
    ? DEMO_MEMBERSHIP_CARDS.find((card) => card.verifyToken === token)
    : undefined;

  const view: CardView | null = backendConfigured
    ? realCard
      ? { ...realCard, isDemo: false }
      : null
    : demoCard
      ? {
          clubSlug: demoCard.clubSlug,
          clubName: demoCard.clubName,
          personName: demoCard.personName,
          personDepartment: demoCard.personDepartment,
          role: demoCard.role,
          since: demoCard.since,
          status: 'approved',
          isDemo: true,
        }
      : null;

  const demoClub = !backendConfigured && view ? DEMO_CLUBS.find((c) => c.slug === view.clubSlug) : undefined;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-campus-bg px-4 py-10 dark:bg-campus-dark-bg">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          <p className="font-display text-lg font-extrabold">
            <span className="text-violet-ink">NUB</span>CONNECT
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-campus-text-sec dark:text-campus-dark-sec">
            Membership verification
          </p>
        </div>

        {loading && (
          <div className="glass-strong animate-pulse rounded-3xl p-5 shadow-lift" aria-busy="true">
            <div className="h-12 rounded-2xl bg-campus-bg dark:bg-campus-dark-elev" />
            <div className="mt-4 h-4 w-2/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
            <div className="mt-2 h-3 w-1/2 rounded bg-campus-bg dark:bg-campus-dark-elev" />
          </div>
        )}

        {!loading && error && (
          <div className="glass-strong rounded-3xl p-5 text-center shadow-lift">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-soft dark:bg-coral/15">
              <ShieldAlert size={22} className="text-coral-ink dark:text-coral" />
            </span>
            <h1 className="mt-3 font-display text-base font-extrabold">Verification unavailable</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {error}
            </p>
            <button
              onClick={retry}
              className="touch-target mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum"
            >
              <RefreshCw size={13} /> Try again
            </button>
          </div>
        )}

        {!loading && !error && view && (
          <div className="glass-strong rounded-3xl p-5 shadow-lift">
            {view.status === 'approved' ? (
              <div className="mb-3 flex items-center gap-2.5 rounded-2xl bg-lime-soft p-3 dark:bg-lime/15">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime text-plum">
                  <BadgeCheck size={19} />
                </span>
                <p className="text-sm font-bold text-lime-ink dark:text-lime">
                  Verified
                  <span className="block text-[11px] font-semibold">
                    This membership card is genuine
                  </span>
                </p>
              </div>
            ) : (
              <div className="mb-3 flex items-center gap-2.5 rounded-2xl bg-coral-soft p-3 dark:bg-coral/15">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral text-white">
                  <ShieldAlert size={19} />
                </span>
                <p className="text-sm font-bold text-coral-ink dark:text-coral">
                  Not active
                  <span className="block text-[11px] font-semibold">
                    This membership is no longer active
                  </span>
                </p>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Club
                </dt>
                <dd className="font-display font-bold">{view.clubName}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Member
                </dt>
                <dd className="font-semibold">{view.personName}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Department
                </dt>
                <dd className="font-semibold">{view.personDepartment}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Role
                </dt>
                <dd className="font-semibold">{view.role}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                  Member since
                </dt>
                <dd className="font-semibold">{view.since}</dd>
              </div>
            </dl>

            <p className="mt-3 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Issued by the club on NUBCONNECT. This page shows only what is printed on the card —
              nothing more.
              {view.isDemo && ' (DEMO card — synthetic content.)'}
            </p>

            {demoClub && (
              <Link
                href={`/clubs/${demoClub.slug}`}
                className="mt-3 block rounded-xl bg-violet py-2.5 text-center text-xs font-bold text-plum"
              >
                View club page
              </Link>
            )}
          </div>
        )}

        {!loading && !error && !view && (
          <div className="glass-strong rounded-3xl p-5 text-center shadow-lift">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-soft dark:bg-coral/15">
              <ShieldAlert size={22} className="text-coral-ink dark:text-coral" />
            </span>
            <h1 className="mt-3 font-display text-base font-extrabold">
              This card can&apos;t be verified
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              The link doesn&apos;t match any issued membership card. Cards can be revoked when
              membership ends — check with the club committee before accepting it.
            </p>
          </div>
        )}

        <p className="mt-4 text-center text-[10px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          Verification links open this page only — they never open a chat or reveal contact details.
        </p>
      </div>
    </main>
  );
}
