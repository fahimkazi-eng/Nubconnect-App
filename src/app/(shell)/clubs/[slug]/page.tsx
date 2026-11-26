'use client';

// ============================================================================
// CAMPUS ORBIT — Club Universe club page (§7).
//
// Real backend clubs read their public identity, leadership, committee,
// recognition and caller membership state through the Phase 4 RPCs. Demo
// clubs keep the clearly-labelled roster + member-run depth. University-level
// verification is never editable from this page.
// ============================================================================
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CalendarClock,
  Clock3,
  ExternalLink,
  History,
  IdCard,
  Image as ImageIcon,
  Info,
  MessageCircle,
  Settings2,
  Trophy,
  Users,
} from 'lucide-react';
import { DEMO_EVENTS, DEMO_POSTS } from '@/lib/demo/dataset';
import { useApp } from '@/lib/store';
import { coverScene } from '@/lib/photos';
import { Avatar, DemoTag, Tabs, VerifiedBadge } from '@/components/ui/kit';
import PostCard from '@/components/feed/PostCard';
import { pluralize } from '@/lib/format';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { loadClubDetail, type ClubDetail } from '@/lib/clubs';

interface CommitteeDisplay {
  key: string;
  name: string;
  role: string;
  since?: string;
  note?: string;
  isDemo: boolean;
}

export default function ClubDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const {
    user,
    clubs,
    clubsLoading,
    managedClubSlugs,
    joinedClubs,
    clubApplications,
    applyToClub,
    withdrawClubApplication,
    leaveClub,
    startConversation,
  } = useApp();
  const [tab, setTab] = useState('feed');
  const [detail, setDetail] = useState<ClubDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const club = clubs.find((c) => c.slug === slug);
  const isRealClub = Boolean(club?.organizationId) && !club?.isDemo;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!club || !isRealClub || !supabase || !isBackendConfigured() || user.isDemo) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let active = true;
    setDetailLoading(true);
    void loadClubDetail(supabase, club.slug).then((result) => {
      if (!active) return;
      setDetail(result.detail);
      setDetailError(result.error);
      setDetailLoading(false);
    });
    return () => {
      active = false;
    };
  }, [club, isRealClub, user.isDemo]);

  if (clubsLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-4 w-24 animate-pulse rounded bg-campus-bg dark:bg-campus-dark-elev" />
        <div className="card animate-pulse overflow-hidden p-0">
          <div className="h-32 bg-campus-bg dark:bg-campus-dark-elev sm:h-44" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-2/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
            <div className="h-3 w-1/2 rounded bg-campus-bg dark:bg-campus-dark-elev" />
          </div>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-bold">Club not available</p>
        <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
          This club is not in the current directory. Nothing is invented to fill the gap.
        </p>
        <Link
          href="/circle?tab=clubs"
          className="touch-target mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-plum shadow-violet-glow"
        >
          <ArrowLeft size={15} /> All clubs
        </Link>
      </div>
    );
  }

  const isMember = joinedClubs.includes(club.slug) || detail?.myMembership?.status === 'approved';
  const applied = clubApplications.includes(club.slug) || detail?.myMembership?.status === 'pending';
  const isManager = managedClubSlugs.includes(club.slug) || Boolean(detail?.isManager);
  const myCard = `/passport#card-${club.slug}`;
  const memberCount = detail?.memberCount ?? club.memberCount;
  const verification = club.verification ?? club.verificationStatus;
  const aliases = detail?.aliases ?? club.aliases ?? [];
  const applicationsOpen = club.membershipOpen !== false;
  // Source links come from the club record, so only render absolute http(s)
  // URLs — never let a stored javascript:/data: value become a clickable link.
  const safeSourceUrl =
    club.sourceUrl && /^https?:\/\//i.test(club.sourceUrl) ? club.sourceUrl : null;

  const posts = isRealClub
    ? []
    : DEMO_POSTS.filter(
        (p) =>
          p.authorId === `club-${slug}` ||
          p.body.toLowerCase().includes(club.name.split(' ')[0]!.toLowerCase()),
      );
  const events = isRealClub
    ? []
    : DEMO_EVENTS.filter((e) =>
        e.organizer.includes(club.name.split(' ')[1] ?? club.name.split(' ')[0]!),
      );

  const committee: CommitteeDisplay[] = detail
    ? [
        ...detail.representatives.map((r) => ({
          key: `rep-${r.userId}`,
          name: r.name,
          role: r.designation,
          note: 'Club representative',
          isDemo: false,
        })),
        ...detail.committee.map((c) => ({
          key: `committee-${c.roleTitle}-${c.memberName}`,
          name: c.memberName,
          role: c.roleTitle,
          since: c.sessionTerm,
          note: c.isVerifiedSource ? 'Verified source' : 'Club-provided',
          isDemo: false,
        })),
      ]
    : (club.committee ?? []).map((m) => ({
        key: `demo-${m.personId}-${m.role}`,
        name: m.name,
        role: m.role,
        since: m.since,
        note: m.note,
        isDemo: true,
      }));

  return (
    <div>
      <Link
        href="/circle?tab=clubs"
        className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline"
      >
        <ArrowLeft size={14} /> All clubs
      </Link>

      <div className="card overflow-hidden p-0">
        <div className="relative h-32 sm:h-44">
          {club.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : isRealClub ? (
            <div className="h-full w-full bg-gradient-to-br from-violet via-aqua to-lime" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverScene(club.slug, 1200, 500)} alt="" className="h-full w-full object-cover" />
          )}
          {!isRealClub && (
            <span className="absolute right-2 top-2">
              <DemoTag compact />
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            {club.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={club.logoUrl}
                alt=""
                className="-mt-10 h-16 w-16 shrink-0 rounded-2xl object-cover shadow-lift ring-4 ring-white dark:ring-campus-dark-card"
              />
            ) : (
              <span className="-mt-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-aqua font-display text-lg font-extrabold text-plum shadow-lift ring-4 ring-white dark:ring-campus-dark-card">
                {club.name.replace(/[^A-Z]/g, '').slice(0, 2) || 'CL'}
              </span>
            )}
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="font-display text-lg font-extrabold leading-tight sm:text-xl">
                {club.name}
              </h1>
              <p className="mt-0.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                {club.category} • {club.scope} • {pluralize(memberCount, 'member')}
              </p>
              {aliases.length > 0 && (
                <p className="mt-1 text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                  Also known as {aliases.slice(0, 2).join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VerifiedBadge label={verification} />
            {applicationsOpen ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                <BadgeCheck size={12} /> Membership applications open to NUB students
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-campus-text-sec dark:text-campus-dark-sec">
                <Clock3 size={12} /> Applications are closed right now
              </span>
            )}
          </div>

          <p className="mt-2.5 text-sm leading-relaxed">{club.about}</p>

          {detailLoading && (
            <p className="mt-2 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              Loading live club records…
            </p>
          )}
          {detailError && (
            <p className="mt-2 rounded-xl bg-coral-soft px-3 py-2 text-[11px] font-semibold text-coral-ink dark:bg-coral/15 dark:text-coral">
              {detailError}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {isMember ? (
              <>
                <span className="flex flex-1 items-center justify-center rounded-xl bg-lime-soft py-2.5 text-sm font-bold text-lime-ink ring-1 ring-lime/40 dark:bg-lime/15 dark:text-lime sm:flex-none sm:px-6">
                  ✓ Member
                </span>
                <Link
                  href={myCard}
                  className="touch-target flex items-center justify-center gap-1.5 rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                >
                  <IdCard size={16} className="text-violet-ink" /> My card
                </Link>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Leave this club? Your membership card will stop verifying.',
                      )
                    ) {
                      void leaveClub(club.slug);
                    }
                  }}
                  className="touch-target flex items-center justify-center rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
                >
                  Leave
                </button>
              </>
            ) : applied ? (
              <>
                <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-campus-bg py-2.5 text-sm font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border sm:flex-none sm:px-6">
                  <Clock3 size={15} /> Application pending
                </span>
                <button
                  onClick={() => void withdrawClubApplication(club.slug)}
                  className="touch-target flex items-center justify-center rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
                >
                  Withdraw
                </button>
              </>
            ) : applicationsOpen ? (
              <button
                onClick={() => void applyToClub(club.slug)}
                className="touch-target flex-1 rounded-xl bg-violet py-2.5 text-sm font-bold text-plum shadow-violet-glow sm:flex-none sm:px-6"
              >
                Apply to join
              </button>
            ) : (
              <span className="flex flex-1 items-center justify-center rounded-xl bg-campus-bg py-2.5 text-sm font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border sm:flex-none sm:px-6">
                Applications closed
              </span>
            )}

            {!isRealClub && (
              <button
                onClick={() =>
                  startConversation({
                    personId: `club-${club.slug}`,
                    title: `${club.name}`,
                    initialNote: 'Hi! Question about your upcoming activities.',
                  })
                }
                className="touch-target flex items-center justify-center gap-1.5 rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
              >
                <MessageCircle size={16} className="text-violet-ink" /> Message
              </button>
            )}

            {isManager && (
              <Link
                href={`/clubs/${club.slug}/manage`}
                className="touch-target flex items-center justify-center gap-1.5 rounded-xl bg-violet-soft px-4 py-2.5 text-sm font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet"
              >
                <Settings2 size={16} /> Control Center
              </Link>
            )}

            {!isRealClub && club.slug === 'nubcc' && (
              <a
                href="https://www.nubcc.club/"
                target="_blank"
                rel="noopener noreferrer"
                className="touch-target flex items-center justify-center gap-1.5 rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
              >
                <ExternalLink size={15} className="text-aqua-ink dark:text-aqua" /> Website
              </a>
            )}
          </div>

          {safeSourceUrl && (
            <p className="mt-2.5 text-[10px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              <Info size={10} className="mr-1 inline align-[-1px]" />
              Source:{' '}
              <a
                href={safeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-violet-ink hover:underline"
              >
                {safeSourceUrl}
              </a>
            </p>
          )}
          {club.sourceNote && (
            <p className="mt-2.5 text-[10px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              <Info size={10} className="mr-1 inline align-[-1px]" />
              {club.sourceNote}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { key: 'feed', label: 'Feed', count: posts.length },
            { key: 'committee', label: 'Committee' },
            { key: 'achievements', label: 'Recognition' },
            { key: 'gallery', label: 'Gallery' },
            { key: 'events', label: 'Events', count: events.length },
            { key: 'about', label: 'About' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-3 space-y-3">
        {tab === 'feed' &&
          (posts.length > 0 ? (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          ) : (
            <div className="card p-8 text-center">
              <p className="font-display font-bold">No club posts yet</p>
              <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                {isRealClub
                  ? 'Real club activity posts will appear here once a representative publishes one. Nothing is fabricated.'
                  : `Activity posts from ${club.name.split(' ')[0]} will appear here.`}
              </p>
            </div>
          ))}

        {tab === 'committee' && (
          <div className="space-y-3">
            {committee.length > 0 ? (
              <>
                <p className="px-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                  {isRealClub
                    ? 'Club leadership and committee records from the university database.'
                    : 'Current committee'}{' '}
                  {!isRealClub && <DemoTag compact />}{' '}
                  {!isRealClub &&
                    '— committee rosters are set by the club, not the university.'}
                </p>
                <div className="card divide-y divide-campus-border p-0 dark:divide-campus-dark-border">
                  {committee.map((m) => (
                    <div key={m.key} className="flex items-center gap-3 p-3.5">
                      <Avatar seed={m.key} name={m.name} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{m.name}</p>
                        <p className="text-[11px] font-semibold text-violet-ink">
                          {m.role}
                          {m.since ? ` · since ${m.since}` : ''}
                        </p>
                        {m.note && (
                          <p className="truncate text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                            {m.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="card p-8 text-center">
                <Users
                  size={22}
                  className="mx-auto text-campus-text-sec dark:text-campus-dark-sec"
                />
                <p className="mt-2 font-display font-bold">Committee roster not published</p>
                <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                  This club has not listed its current committee on NUBCONNECT yet.
                </p>
              </div>
            )}
            {!isRealClub && (club.committeeHistory ?? []).length > 0 && (
              <div className="card p-4">
                <h2 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold">
                  <History size={14} className="text-violet-ink" /> Committee history
                </h2>
                <ol className="space-y-2">
                  {(club.committeeHistory ?? []).map((m) => (
                    <li
                      key={m.personId + m.role}
                      className="flex items-start gap-2 text-xs text-campus-text-sec dark:text-campus-dark-sec"
                    >
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                      <span>
                        <b className="text-campus-text dark:text-campus-dark-text">{m.name}</b> —{' '}
                        {m.role} ({m.since}){m.note ? `. ${m.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {tab === 'achievements' && (
          <div className="space-y-3">
            {isRealClub ? (
              detail && detail.honours.length > 0 ? (
                <>
                  <p className="px-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    Campus Honours recognition awarded by this club to approved members. Students
                    never self-report.
                  </p>
                  {detail.honours.map((h) => (
                    <div key={h.id} className="card flex items-start gap-3 p-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime">
                        <Trophy size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">
                          {h.title}{' '}
                          <span className="font-mono text-[11px] font-bold text-violet-ink">
                            +{h.points}
                          </span>
                        </p>
                        <p className="text-[11px] font-semibold text-violet-ink">
                          {h.personName} • {h.category} • {h.semester}
                        </p>
                        {h.detail && (
                          <p className="mt-0.5 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                            {h.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="card p-8 text-center">
                  <Award
                    size={22}
                    className="mx-auto text-campus-text-sec dark:text-campus-dark-sec"
                  />
                  <p className="mt-2 font-display font-bold">No recognition awarded yet</p>
                  <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                    Club representatives can award Campus Honours to approved members from the
                    Control Center.
                  </p>
                </div>
              )
            ) : (club.achievements ?? []).length > 0 ? (
              (club.achievements ?? []).map((a) => (
                <div key={a.year + a.title} className="card flex items-start gap-3 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime">
                    <Trophy size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {a.title}{' '}
                      <span className="font-mono text-[11px] font-bold text-violet-ink">
                        {a.year}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                      {a.detail}
                    </p>
                  </div>
                  <DemoTag compact />
                </div>
              ))
            ) : (
              <div className="card p-8 text-center">
                <Award
                  size={22}
                  className="mx-auto text-campus-text-sec dark:text-campus-dark-sec"
                />
                <p className="mt-2 font-display font-bold">No achievements listed yet</p>
                <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                  Verified milestones — competitions, programs, exhibitions — appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'gallery' && (
          <div className="space-y-3">
            {!isRealClub && (club.gallery ?? []).length > 0 ? (
              <>
                <p className="px-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                  Photo-only club activity <DemoTag compact /> — generated demo scenes, not real
                  club photos.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(club.gallery ?? []).map((g, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={g}
                      src={g}
                      alt={`Club activity photo ${i + 1}`}
                      loading="lazy"
                      className="h-32 w-full rounded-2xl object-cover ring-1 ring-campus-border dark:ring-campus-dark-border sm:h-40"
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="card p-8 text-center">
                <ImageIcon
                  size={22}
                  className="mx-auto text-campus-text-sec dark:text-campus-dark-sec"
                />
                <p className="mt-2 font-display font-bold">No photos yet</p>
                <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                  This release is photo-only — clubs share stills from their activities. Real club
                  galleries are not published in this build.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-2">
            {events.length > 0 ? (
              events.map((e) => (
                <div key={e.id} className="card p-3.5">
                  <p className="text-sm font-bold">{e.title}</p>
                  <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                    {[e.date, e.startTime, e.venue].filter(Boolean).join(' • ')}
                  </p>
                </div>
              ))
            ) : (
              <div className="card p-8 text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
                No upcoming events listed for this club.
              </div>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="card space-y-3 p-4 text-sm">
            <p className="font-display font-bold">About {club.name}</p>
            <p className="leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {club.about}
            </p>
            {club.membershipRequirements && (
              <div className="rounded-2xl bg-campus-bg p-3 dark:bg-campus-dark-elev">
                <p className="text-xs font-bold">Membership requirements</p>
                <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                  {club.membershipRequirements}
                </p>
              </div>
            )}
            <div className="rounded-2xl bg-campus-bg p-3 dark:bg-campus-dark-elev">
              <p className="text-xs font-bold">Verification level — {verification}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                Club Universe levels run: Officially Verified (university), Club Verified (club with
                student sign-off), Department Recognized, Student-Led, Awaiting Verification,
                Inactive, Archived. University-level verification can only be granted by the
                university — club representatives can never set it themselves, including from the{' '}
                {isManager ? (
                  <Link
                    href={`/clubs/${club.slug}/manage`}
                    className="font-bold text-violet-ink hover:underline"
                  >
                    Control Center
                  </Link>
                ) : (
                  'Control Center'
                )}
                .
              </p>
              <Link
                href="/help"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-violet-ink hover:underline"
              >
                <CalendarClock size={11} /> What do the levels mean?
              </Link>
            </div>
            <p className="text-xs text-campus-text-sec dark:text-campus-dark-sec">
              Membership is open to NUB students. Club representatives manage this page;
              verification status can only be changed by university admins, never by club reps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
