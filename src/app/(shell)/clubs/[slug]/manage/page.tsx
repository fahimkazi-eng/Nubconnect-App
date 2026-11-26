'use client';

// ============================================================================
// NUBCONNECT — Club Control Center (§27).
//
// Only operations with an enforcing SECURITY DEFINER RPC or a safe RLS write
// path are enabled. Everything else is listed as unavailable with the exact
// backend reason. University verification is only ever requested here, never
// granted. There is no demo state, invented roster or synthetic audit entry.
// ============================================================================
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Check,
  ClipboardList,
  Clock3,
  FileClock,
  GraduationCap,
  IdCard,
  Lock,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar, VerifiedBadge } from '@/components/ui/kit';
import { pluralize } from '@/lib/format';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import {
  awardClubHonour,
  getClubManageActions,
  loadClubManageData,
  loadManagedClubPage,
  publishClubPagePost,
  requestClubVerification,
  reviewClubApplication,
  setClubMemberRole,
  updateClubOrganizationDetails,
  updateManagedClubPage,
  type ClubManageActionAvailability,
  type ClubManageActionId,
  type ClubManageData,
  type ClubOrganizationDetails,
  type ManagedClubPage,
} from '@/lib/clubs';
import ClubMediaManager from '@/components/clubs/ClubMediaManager';
import { HONOUR_CATEGORIES } from '@/lib/orbit';
import type { HonourCategory } from '@/lib/types';

/** President is deliberately excluded: leadership changes are university-only. */
const ASSIGNABLE_ROLES = [
  'Member',
  'Vice President',
  'General Secretary',
  'Treasurer',
  'Event Coordinator',
  'Volunteer',
  'Moderator',
  'Executive Member',
] as const;

const POST_CATEGORIES = ['announcement', 'activity', 'achievement', 'resource'] as const;

interface ActionResult {
  error: string | null;
}

type DetailsForm = ClubOrganizationDetails;

const EMPTY_DETAILS: DetailsForm = {
  shortDescription: '',
  about: '',
  membershipOpen: true,
  membershipRequirements: '',
  officialWebsite: '',
  publicContactEmail: '',
};

export default function ClubControlCenterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, clubs, clubsLoading, managedClubSlugs, pushToast } = useApp();

  const club = clubs.find((c) => c.slug === slug);
  const organizationId = club?.organizationId ?? null;
  const isRealClub = Boolean(organizationId) && !club?.isDemo;
  const isManager = managedClubSlugs.includes(slug) || Boolean(club?.isManager);
  const backendReady = isBackendConfigured();

  const [manage, setManage] = useState<ClubManageData | null>(null);
  const [manageLoading, setManageLoading] = useState(true);
  const [manageError, setManageError] = useState<string | null>(null);
  const [page, setPage] = useState<ManagedClubPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [detailsForm, setDetailsForm] = useState<DetailsForm>(EMPTY_DETAILS);
  const [pageForm, setPageForm] = useState({ name: '', description: '' });
  const [reviewRoles, setReviewRoles] = useState<Record<string, string>>({});
  const [verificationNotes, setVerificationNotes] = useState('');
  const [postForm, setPostForm] = useState({
    title: '',
    body: '',
    category: 'announcement' as (typeof POST_CATEGORIES)[number],
  });

  const reload = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !organizationId || !backendReady) {
      setManageLoading(false);
      setPageLoading(false);
      return;
    }

    setManageLoading(true);
    setPageLoading(true);
    setManageError(null);
    setPageError(null);
    const [manageResult, pageResult] = await Promise.all([
      loadClubManageData(supabase, organizationId),
      loadManagedClubPage(supabase, organizationId),
    ]);
    setManage(manageResult.data);
    setManageError(manageResult.error);
    setPage(pageResult.page);
    setPageError(pageResult.error);
    setManageLoading(false);
    setPageLoading(false);
  }, [backendReady, organizationId]);

  useEffect(() => {
    if (isRealClub && isManager && !user.isDemo && organizationId && backendReady) {
      void reload();
      return;
    }
    setManageLoading(false);
    setPageLoading(false);
  }, [backendReady, isManager, isRealClub, organizationId, reload, user.isDemo]);

  useEffect(() => {
    if (!manage?.details) return;
    setDetailsForm({ ...manage.details });
  }, [manage?.details]);

  useEffect(() => {
    if (!page) return;
    setPageForm({ name: page.name, description: page.description ?? '' });
  }, [page]);

  const availability = useMemo(
    () =>
      getClubManageActions({
        backendConfigured: backendReady && !user.isDemo,
        isManager,
        organizationId,
        linkedPageId: page?.id ?? null,
        canManageLinkedPage: Boolean(page?.canManage),
        universityId: user.primaryUniversityId ?? null,
      }),
    [
      backendReady,
      isManager,
      isRealClub,
      organizationId,
      page?.canManage,
      page?.id,
      user.isDemo,
      user.primaryUniversityId,
    ],
  );

  const isAvailable = useCallback(
    (id: ClubManageActionId) => availability.find((action) => action.id === id)?.available ?? false,
    [availability],
  );

  const runConfirmed = useCallback(
    async (
      key: string,
      confirmation: string,
      operation: () => Promise<ActionResult>,
      successMessage: string,
    ) => {
      if (typeof window !== 'undefined' && !window.confirm(confirmation)) return;
      setBusy(key);
      const result = await operation();
      setBusy(null);
      if (result.error) {
        pushToast(result.error, 'warning');
        return;
      }
      pushToast(successMessage, 'success');
      await reload();
    },
    [pushToast, reload],
  );

  const availableNow = availability.filter((action) => action.available);
  const readyButBlocked = availability.filter(
    (action) => action.backendSupported && !action.available,
  );
  const requiresBackend = availability.filter((action) => !action.backendSupported);

  if (clubsLoading) {
    return (
      <div className="card animate-pulse p-6" aria-busy="true">
        <div className="h-4 w-1/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
        <div className="mt-3 h-3 w-2/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-bold">Club not available</p>
        <p className="mt-1 text-sm text-campus-text-sec dark:text-campus-dark-sec">
          This club is not in the current directory.
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

  if (!isRealClub || !backendReady || user.isDemo) {
    return (
      <div className="space-y-4">
        <BackLink club={club.name} slug={club.slug} />
        <div className="card p-6">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-campus-bg dark:bg-campus-dark-elev">
            <Lock size={22} className="text-violet-ink" />
          </span>
          <h1 className="mt-3 text-center font-display text-lg font-extrabold">
            No database-backed club record
          </h1>
          <p className="mx-auto mt-1.5 max-w-lg text-center text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            This club has no managed organization ID in the connected backend. No demo approvals,
            roles, honours or audit entries are shown here.
          </p>
        </div>
        <ActionLists
          availableNow={[]}
          readyButBlocked={readyButBlocked}
          requiresBackend={requiresBackend}
        />
      </div>
    );
  }

  if (!isManager) {
    return (
      <div>
        <BackLink club={club.name} slug={club.slug} />
        <div className="card p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-campus-bg dark:bg-campus-dark-elev">
            <Lock size={24} className="text-violet-ink" />
          </span>
          <h1 className="mt-3 font-display text-lg font-extrabold">
            Control Center is for club representatives
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Only an acting representative of {club.name} or a university admin can manage
            applications, member roles and recognition here. University admins assign
            representative roles.
          </p>
          <Link
            href="/help"
            className="mt-4 inline-block rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum"
          >
            How club roles work
          </Link>
        </div>
      </div>
    );
  }

  const verification = manage?.club.verification ?? club.verification ?? club.verificationStatus;
  const memberCount = manage?.memberCount ?? club.memberCount;
  const pendingReview = manage?.verificationRequests.some((request) => request.status === 'pending');
  const canReview = isAvailable('reviewApplications');
  const canSetRoles = isAvailable('setMemberRoles');
  const canAward = isAvailable('awardHonours');
  const canRequestReview = isAvailable('requestVerification');
  const canEditDetails = isAvailable('editClubDetails');
  const canEditMedia = isAvailable('uploadClubMedia');
  const canEditPage = isAvailable('editLinkedPage');
  const canPublishPost = isAvailable('publishPagePosts');

  return (
    <div className="space-y-4">
      <BackLink club={club.name} slug={club.slug} />

      <header className="card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-aqua font-display text-base font-extrabold text-plum">
            {club.name.replace(/[^A-Z]/g, '').slice(0, 2) || 'CL'}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Settings2 size={18} className="text-violet-ink" /> Control Center
            </h1>
            <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              {club.name} • {pluralize(memberCount, 'member')} •{' '}
              {managedClubSlugs.includes(slug)
                ? 'You are a club representative'
                : 'University admin access'}
            </p>
          </div>
        </div>
        <p className="mt-2.5 rounded-xl bg-campus-bg p-2.5 text-[11px] leading-relaxed text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
          <ShieldCheck size={11} className="mr-1 inline align-[-1px] text-violet-ink" />
          Database checks decide every write. Approved applications, role changes and honours are
          audited by the database. This page can request university verification but can never
          grant it.
        </p>
      </header>

      <ActionLists
        availableNow={availableNow}
        readyButBlocked={readyButBlocked}
        requiresBackend={requiresBackend}
      />

      {manageLoading && !manage && (
        <div className="card animate-pulse p-6" aria-busy="true">
          <div className="h-4 w-1/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
          <div className="mt-3 h-3 w-2/3 rounded bg-campus-bg dark:bg-campus-dark-elev" />
        </div>
      )}

      {manageError && (
        <div className="card p-4" role="alert">
          <p className="text-sm font-bold">Control Center unavailable</p>
          <p className="mt-1 text-xs text-campus-text-sec dark:text-campus-dark-sec">
            {manageError}
          </p>
          <button
            onClick={() => void reload()}
            className="touch-target mt-3 rounded-xl bg-violet px-4 py-2 text-xs font-bold text-plum"
          >
            Try again
          </button>
        </div>
      )}

      {/* Verification status and review requests */}
      <section className="card p-4" aria-labelledby="cc-verify-h">
        <h2 id="cc-verify-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <BadgeCheck size={15} className="text-violet-ink" /> Verification level
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VerifiedBadge label={verification} />
          <span className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
            {club.scope} scope • university database record
          </span>
        </div>
        <div className="mt-3 rounded-2xl bg-campus-bg p-3.5 dark:bg-campus-dark-elev">
          <p className="flex items-start gap-2 text-xs leading-relaxed">
            <GraduationCap size={15} className="mt-0.5 shrink-0 text-aqua-ink dark:text-aqua" />
            <span className="text-campus-text-sec dark:text-campus-dark-sec">
              <b className="text-campus-text dark:text-campus-dark-text">
                “Officially Verified” is not granted here.
              </b>{' '}
              The university reviews requests through its own process. Submitting a request leaves
              the current status unchanged.
            </span>
          </p>

          {manageLoading && !manage ? (
            <p className="mt-2 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              Loading review requests…
            </p>
          ) : manage?.verificationRequests.length ? (
            <ul className="mt-2.5 space-y-1.5">
              {manage.verificationRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-2.5 py-1.5 text-[10px] dark:bg-campus-dark-card"
                >
                  <span className="truncate font-semibold">
                    {request.advisorName || 'University review request'}
                    {request.notes ? ` — ${request.notes}` : ''}
                  </span>
                  <span className="shrink-0 rounded-full bg-campus-bg px-2 py-0.5 font-bold dark:bg-campus-dark-elev">
                    {request.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            manage && (
              <p className="mt-2 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                No verification review requests on record.
              </p>
            )
          )}

          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void runConfirmed(
                'verification',
                'Send this request to the university? Your club’s verification status will not change until they review it.',
                async () => {
                  const supabase = getSupabaseBrowserClient();
                  if (!supabase || !organizationId) return { error: 'Club data is not available.' };
                  return requestClubVerification(supabase, organizationId, verificationNotes);
                },
                'Verification review requested. The university will decide the status.',
              );
            }}
          >
            <label className="block text-[11px] font-bold">
              Notes for the reviewer{' '}
              <span className="font-normal text-campus-text-sec dark:text-campus-dark-sec">
                (optional)
              </span>
              <textarea
                value={verificationNotes}
                onChange={(event) => setVerificationNotes(event.target.value)}
                rows={2}
                disabled={!canRequestReview || Boolean(pendingReview)}
                className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
              />
            </label>
            <button
              type="submit"
              disabled={!canRequestReview || Boolean(pendingReview) || busy === 'verification'}
              className="touch-target rounded-xl bg-violet px-3.5 py-2 text-[11px] font-bold text-plum disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!canRequestReview
                ? 'Review requests unavailable'
                : pendingReview
                  ? 'Review already pending'
                  : busy === 'verification'
                    ? 'Sending…'
                    : 'Request university re-verification'}
            </button>
          </form>
        </div>
      </section>

      {/* Club branding — logo + cover via covers bucket + organizations RLS */}
      <ClubMediaManager
        organizationId={organizationId ?? ''}
        logoUrl={club?.logoUrl ?? null}
        coverUrl={club?.coverUrl ?? null}
        canEdit={canEditMedia && Boolean(organizationId)}
      />

      {/* Club details — safe organizations RLS update */}
      <section className="card p-4" aria-labelledby="cc-details-h">
        <h2 id="cc-details-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <Settings2 size={15} className="text-violet-ink" /> Club details
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          Saves through the organizations RLS policy. Verification, category and leadership are
          never changed here.
        </p>
        <form
          className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void runConfirmed(
              'club-details',
              'Save these club details? Verification status is not included.',
              async () => {
                const supabase = getSupabaseBrowserClient();
                if (!supabase || !organizationId) return { error: 'Club data is not available.' };
                return updateClubOrganizationDetails(supabase, {
                  ...detailsForm,
                  organizationId,
                });
              },
              'Club details saved.',
            );
          }}
        >
          <label className="block text-[11px] font-bold">
            Short description
            <input
              value={detailsForm.shortDescription}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, shortDescription: event.target.value }))
              }
              required
              disabled={!canEditDetails}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>
          <label className="block text-[11px] font-bold">
            Membership requirements
            <input
              value={detailsForm.membershipRequirements}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, membershipRequirements: event.target.value }))
              }
              disabled={!canEditDetails}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>
          <label className="block text-[11px] font-bold sm:col-span-2">
            About
            <textarea
              value={detailsForm.about}
              onChange={(event) => setDetailsForm((prev) => ({ ...prev, about: event.target.value }))}
              rows={3}
              disabled={!canEditDetails}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>
          <label className="block text-[11px] font-bold">
            Official website
            <input
              type="url"
              value={detailsForm.officialWebsite}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, officialWebsite: event.target.value }))
              }
              disabled={!canEditDetails}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>
          <label className="block text-[11px] font-bold">
            Public contact email
            <input
              type="email"
              value={detailsForm.publicContactEmail}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, publicContactEmail: event.target.value }))
              }
              disabled={!canEditDetails}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] font-bold sm:col-span-2">
            <input
              type="checkbox"
              checked={detailsForm.membershipOpen}
              onChange={(event) =>
                setDetailsForm((prev) => ({ ...prev, membershipOpen: event.target.checked }))
              }
              disabled={!canEditDetails}
              className="h-4 w-4 rounded border-campus-border dark:border-campus-dark-border"
            />
            Accept new membership applications
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!canEditDetails || manageLoading || busy === 'club-details'}
              className="touch-target w-full rounded-xl bg-violet py-2.5 text-xs font-bold text-plum disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'club-details' ? 'Saving…' : 'Save club details'}
            </button>
          </div>
        </form>
      </section>

      {/* Linked Page — safe pages RLS update + posts RLS publish */}
      <section className="card p-4" aria-labelledby="cc-page-h">
        <h2 id="cc-page-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <ShieldCheck size={15} className="text-violet-ink" /> Linked club Page
        </h2>
        {pageLoading && !page ? (
          <p className="mt-2 text-xs text-campus-text-sec dark:text-campus-dark-sec">
            Loading the linked Page…
          </p>
        ) : pageError ? (
          <p className="mt-2 text-xs text-coral-ink dark:text-coral" role="alert">
            {pageError}
          </p>
        ) : !page ? (
          <p className="mt-2 text-xs text-campus-text-sec dark:text-campus-dark-sec">
            {availability.find((action) => action.id === 'editLinkedPage')?.reason}
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              {page.name} • {page.slug} • Page manager access: {page.canManage ? 'yes' : 'no'}
            </p>
            <form
              className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void runConfirmed(
                  'page-details',
                  `Save changes to the ${page.name} Page?`,
                  async () => {
                    const supabase = getSupabaseBrowserClient();
                    if (!supabase || !page.canManage) {
                      return { error: 'You do not have Page manager permission.' };
                    }
                    return updateManagedClubPage(supabase, {
                      pageId: page.id,
                      ...pageForm,
                    });
                  },
                  'Club Page details saved.',
                );
              }}
            >
              <label className="block text-[11px] font-bold">
                Page name
                <input
                  value={pageForm.name}
                  onChange={(event) => setPageForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={!canEditPage}
                  className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
                />
              </label>
              <label className="block text-[11px] font-bold">
                Description
                <input
                  value={pageForm.description}
                  onChange={(event) =>
                    setPageForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  disabled={!canEditPage}
                  className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!canEditPage || busy === 'page-details'}
                  className="touch-target w-full rounded-xl bg-violet py-2.5 text-xs font-bold text-plum disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'page-details' ? 'Saving…' : 'Save Page details'}
                </button>
              </div>
            </form>

            <form
              className="mt-4 space-y-2.5 border-t border-campus-border pt-4 dark:border-campus-dark-border"
              onSubmit={(event) => {
                event.preventDefault();
                void runConfirmed(
                  'page-post',
                  `Publish this post as ${page.name}? It will not appear as a personal student post.`,
                  async () => {
                    const supabase = getSupabaseBrowserClient();
                    if (!supabase || !user.primaryUniversityId || !page.canManage) {
                      return { error: 'Page publishing is not available for this account.' };
                    }
                    return publishClubPagePost(supabase, {
                      authorId: user.id,
                      universityId: user.primaryUniversityId,
                      pageId: page.id,
                      verification,
                      ...postForm,
                      visibility: 'university',
                    });
                  },
                  'Published on the club Page.',
                );
              }}
            >
              <p className="text-[11px] font-bold">Publish as the club Page</p>
              <label className="block text-[11px] font-bold">
                Title{' '}
                <span className="font-normal text-campus-text-sec dark:text-campus-dark-sec">
                  (optional)
                </span>
                <input
                  value={postForm.title}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, title: event.target.value }))}
                  disabled={!canPublishPost}
                  className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
                />
              </label>
              <label className="block text-[11px] font-bold">
                Announcement
                <textarea
                  value={postForm.body}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, body: event.target.value }))}
                  rows={3}
                  required
                  disabled={!canPublishPost}
                  className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
                />
              </label>
              <label className="block text-[11px] font-bold">
                Category
                <select
                  value={postForm.category}
                  onChange={(event) =>
                    setPostForm((prev) => ({
                      ...prev,
                      category: event.target.value as (typeof POST_CATEGORIES)[number],
                    }))
                  }
                  disabled={!canPublishPost}
                  className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
                >
                  {POST_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                Published university-wide as the club Page. Department- or member-only visibility
                needs extra targeting fields and is not offered here.
              </p>
              <button
                type="submit"
                disabled={!canPublishPost || busy === 'page-post'}
                className="touch-target w-full rounded-xl bg-violet py-2.5 text-xs font-bold text-plum disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'page-post' ? 'Publishing…' : 'Publish on club Page'}
              </button>
            </form>
          </>
        )}
      </section>

      {/* Membership applications */}
      <section className="card p-4" aria-labelledby="cc-apps-h">
        <h2 id="cc-apps-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <ClipboardList size={15} className="text-violet-ink" /> Membership applications
        </h2>
        <p className="mt-0.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
          Real pending applications. Approving writes an audited membership record; holding or
          rejecting does not invent a card.
        </p>
        {manageLoading && !manage ? (
          <p className="py-4 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
            Loading applications…
          </p>
        ) : !canReview ? (
          <p className="py-4 text-xs text-campus-text-sec dark:text-campus-dark-sec">
            {availability.find((action) => action.id === 'reviewApplications')?.reason}
          </p>
        ) : manage?.applications.length ? (
          <div className="mt-2 divide-y divide-campus-border dark:divide-campus-dark-border">
            {manage.applications.map((application) => {
              const isSelf = application.userId === user.id;
              const role = reviewRoles[application.membershipId] ?? 'Member';
              return (
                <div key={application.membershipId} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar seed={application.userId} name={application.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{application.name}</p>
                      <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                        {application.departmentCode}
                        {application.semester ? ` • ${application.semester}` : ''}
                      </p>
                    </div>
                    {isSelf ? (
                      <span className="rounded-xl bg-campus-bg px-2.5 py-1.5 text-[10px] font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border">
                        Your application — self-review is blocked
                      </span>
                    ) : (
                      <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                        <select
                          value={role}
                          onChange={(event) =>
                            setReviewRoles((prev) => ({
                              ...prev,
                              [application.membershipId]: event.target.value,
                            }))
                          }
                          aria-label={`Approval role for ${application.name}`}
                          className="rounded-xl border border-campus-border bg-white px-2 py-1.5 text-[11px] font-bold dark:border-campus-dark-border dark:bg-campus-dark-card"
                        >
                          {ASSIGNABLE_ROLES.map((assignableRole) => (
                            <option key={assignableRole} value={assignableRole}>
                              {assignableRole}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            void runConfirmed(
                              `approve:${application.membershipId}`,
                              `Approve ${application.name} as ${role}?`,
                              async () => {
                                const supabase = getSupabaseBrowserClient();
                                if (!supabase) return { error: 'Backend is not connected.' };
                                return reviewClubApplication(
                                  supabase,
                                  application.membershipId,
                                  'approved',
                                  role,
                                );
                              },
                              `${application.name} approved as ${role}.`,
                            )
                          }
                          disabled={busy !== null}
                          className="touch-target flex items-center gap-1 rounded-xl bg-violet px-3 py-1.5 text-[11px] font-bold text-plum disabled:opacity-50"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() =>
                            void runConfirmed(
                              `hold:${application.membershipId}`,
                              `Keep ${application.name}'s application pending?`,
                              async () => {
                                const supabase = getSupabaseBrowserClient();
                                if (!supabase) return { error: 'Backend is not connected.' };
                                return reviewClubApplication(
                                  supabase,
                                  application.membershipId,
                                  'pending',
                                );
                              },
                              `${application.name}'s application kept on hold.`,
                            )
                          }
                          disabled={busy !== null}
                          className="touch-target flex items-center gap-1 rounded-xl bg-campus-bg px-3 py-1.5 text-[11px] font-bold text-campus-text-sec ring-1 ring-campus-border disabled:opacity-50 dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
                        >
                          <Clock3 size={12} /> Hold
                        </button>
                        <button
                          onClick={() =>
                            void runConfirmed(
                              `reject:${application.membershipId}`,
                              `Reject ${application.name}'s application? This is recorded in the audit trail.`,
                              async () => {
                                const supabase = getSupabaseBrowserClient();
                                if (!supabase) return { error: 'Backend is not connected.' };
                                return reviewClubApplication(
                                  supabase,
                                  application.membershipId,
                                  'rejected',
                                );
                              },
                              `${application.name}'s application rejected.`,
                            )
                          }
                          disabled={busy !== null}
                          aria-label={`Reject ${application.name}`}
                          className="touch-target flex items-center justify-center rounded-xl bg-campus-bg px-2.5 py-1.5 text-campus-text-sec ring-1 ring-campus-border disabled:opacity-50 dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  {application.motivation && (
                    <p className="mt-1.5 rounded-xl bg-campus-bg px-2.5 py-2 text-[11px] leading-relaxed text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                      “{application.motivation}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
            No pending applications right now.
          </p>
        )}
      </section>

      {/* Members and permitted roles */}
      <section className="card p-4" aria-labelledby="cc-members-h">
        <h2 id="cc-members-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <Users size={15} className="text-violet-ink" /> Members &amp; roles
        </h2>
        <p className="mt-0.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
          Approved members only. President is excluded from this selector; leadership assignment is
          a university-admin action.
        </p>
        {manageLoading && !manage ? (
          <p className="py-4 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
            Loading members…
          </p>
        ) : !canSetRoles ? (
          <p className="py-4 text-xs text-campus-text-sec dark:text-campus-dark-sec">
            {availability.find((action) => action.id === 'setMemberRoles')?.reason}
          </p>
        ) : manage?.members.length ? (
          <div className="mt-2 divide-y divide-campus-border dark:divide-campus-dark-border">
            {manage.members.map((member) => {
              const isSelf = member.userId === user.id;
              const isPresident = member.role === 'President';
              const options = Array.from(new Set([member.role, ...ASSIGNABLE_ROLES]));
              return (
                <div key={member.membershipId} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar seed={member.userId} name={member.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{member.name}</p>
                    <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                      {member.departmentCode}
                      {member.semester ? ` • ${member.semester}` : ''}
                    </p>
                  </div>
                  {isSelf || isPresident ? (
                    <span className="rounded-full bg-violet-soft px-2.5 py-1 text-[10px] font-bold text-violet-ink dark:bg-violet-dark-soft dark:text-violet">
                      {isSelf ? 'You — no self-edit' : 'President — admin-managed'}
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(event) => {
                        const nextRole = event.target.value;
                        void runConfirmed(
                          `role:${member.membershipId}`,
                          `Change ${member.name}'s role from ${member.role} to ${nextRole}?`,
                          async () => {
                            const supabase = getSupabaseBrowserClient();
                            if (!supabase) return { error: 'Backend is not connected.' };
                            return setClubMemberRole(supabase, member.membershipId, nextRole);
                          },
                          `${member.name}'s role updated to ${nextRole}.`,
                        );
                      }}
                      aria-label={`Role for ${member.name}`}
                      className="rounded-xl border border-campus-border bg-white px-2 py-1.5 text-[11px] font-bold dark:border-campus-dark-border dark:bg-campus-dark-card"
                    >
                      {options.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
            No approved members yet.
          </p>
        )}
        <p className="mt-2.5 rounded-xl bg-campus-bg p-2.5 text-[10px] leading-relaxed text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
          {availability.find((action) => action.id === 'removeMembers')?.reason}
        </p>
      </section>

      <RecognitionSection
        members={(manage?.members ?? []).filter((member) => member.userId !== user.id)}
        loading={manageLoading && !manage}
        canAward={canAward}
        busy={busy === 'honour'}
        organizationId={organizationId}
        onAward={async (input) => {
          const supabase = getSupabaseBrowserClient();
          if (!supabase || !organizationId) return { error: 'Club data is not available.' };
          return awardClubHonour(supabase, { ...input, organizationId });
        }}
        onBeforeSubmit={async (input) =>
          typeof window === 'undefined' ||
          window.confirm(
            `Award “${input.title}” to ${input.personName} as club-verified recognition?`,
          )
        }
        onSuccess={() => void reload()}
        pushToast={pushToast}
      />

      {/* Membership cards are issued by the membership RPC, never by this UI. */}
      <section className="card p-4" aria-labelledby="cc-cards-h">
        <h2 id="cc-cards-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <IdCard size={15} className="text-violet-ink" /> Digital membership cards
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          The approve RPC issues a QR token for every approved member. Cards appear in Campus
          Passport; this page never manufactures or prints one locally.
        </p>
      </section>

      {/* Database audit trail */}
      <section className="card p-4" aria-labelledby="cc-audit-h">
        <h2 id="cc-audit-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
          <ScrollText size={15} className="text-violet-ink" /> Audit trail
        </h2>
        <p className="mt-0.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
          Recorded by the club RPCs. Direct Page and organization edits use their own database
          records and are not invented here.
        </p>
        {manageLoading && !manage ? (
          <p className="py-4 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
            Loading activity…
          </p>
        ) : manage?.audit.length ? (
          <ol className="mt-2 space-y-2.5">
            {manage.audit.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2.5">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-soft dark:bg-violet-dark-soft">
                  <FileClock size={11} className="text-violet-ink dark:text-violet" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-snug">{entry.detail}</span>
                  <span className="text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                    {entry.actorName} • {formatWhen(entry.createdAt)} •{' '}
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-4 text-center text-xs text-campus-text-sec dark:text-campus-dark-sec">
            No audited activity recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}

function BackLink({ club, slug }: { club: string; slug: string }) {
  return (
    <Link
      href={`/clubs/${slug}`}
      className="inline-flex items-center gap-1 text-xs font-bold text-violet-ink hover:underline"
    >
      <ArrowLeft size={14} /> {club}
    </Link>
  );
}

function ActionLists({
  availableNow,
  readyButBlocked,
  requiresBackend,
}: {
  availableNow: ClubManageActionAvailability[];
  readyButBlocked: ClubManageActionAvailability[];
  requiresBackend: ClubManageActionAvailability[];
}) {
  return (
    <section className="card p-4" aria-labelledby="cc-actions-h">
      <h2 id="cc-actions-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
        <ShieldCheck size={15} className="text-violet-ink" /> What this Control Center can do
      </h2>
      <p className="mt-0.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
        Every action below is checked against an enforcing RPC or RLS policy. Nothing is enabled on
        a guess.
      </p>

      <ActionGroup
        title="Available now"
        tone="ready"
        actions={availableNow}
        empty="No actions are enabled for this account yet."
      />
      <ActionGroup
        title="Ready in the database, but not active here"
        tone="blocked"
        actions={readyButBlocked}
        empty="Every database-backed action is active."
      />
      <ActionGroup
        title="Requires backend support"
        tone="unsupported"
        actions={requiresBackend}
        empty="No unsupported actions are advertised."
      />
    </section>
  );
}

function ActionGroup({
  title,
  tone,
  actions,
  empty,
}: {
  title: string;
  tone: 'ready' | 'blocked' | 'unsupported';
  actions: ClubManageActionAvailability[];
  empty: string;
}) {
  const badgeClass =
    tone === 'ready'
      ? 'bg-lime-soft text-lime-ink dark:bg-lime/15 dark:text-lime'
      : tone === 'blocked'
        ? 'bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet'
        : 'bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec';
  return (
    <div className="mt-3">
      <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
        {title}
      </h3>
      {actions.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{empty}</p>
      ) : (
        <ul className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <li
              key={action.id}
              className="rounded-xl border border-campus-border p-2.5 dark:border-campus-dark-border"
            >
              <div className="flex items-start gap-2">
                {tone === 'unsupported' && (
                  <Lock size={12} className="mt-0.5 shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
                )}
                <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug">{action.label}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${badgeClass}`}>
                  {tone === 'ready' ? 'Enabled' : tone === 'blocked' ? 'Not active' : 'Disabled'}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                {action.reason ?? 'Allowed by the current database permissions.'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatWhen(value: string | null): string {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface RecognitionInput {
  personId: string;
  personName: string;
  category: HonourCategory;
  title: string;
  detail?: string;
  points: number;
  semester: string;
}

function RecognitionSection({
  members,
  loading,
  canAward,
  busy,
  organizationId,
  onAward,
  onBeforeSubmit,
  onSuccess,
  pushToast,
}: {
  members: { userId: string; name: string; membershipId: string }[];
  loading: boolean;
  canAward: boolean;
  busy: boolean;
  organizationId: string | null;
  onAward: (input: Omit<RecognitionInput, 'personName'>) => Promise<ActionResult>;
  onBeforeSubmit: (input: RecognitionInput) => Promise<boolean> | boolean;
  onSuccess: () => void;
  pushToast: (message: string, tone?: 'success' | 'warning') => void;
}) {
  const [personId, setPersonId] = useState('');
  const [category, setCategory] = useState<HonourCategory>('Mentoring');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [points, setPoints] = useState(10);
  const [semester, setSemester] = useState('Fall 2026');
  const [submitting, setSubmitting] = useState(false);

  const personName = members.find((member) => member.userId === personId)?.name ?? 'this member';
  const isBusy = busy || submitting;
  const canSubmit =
    Boolean(organizationId) &&
    canAward &&
    !isBusy &&
    Boolean(personId) &&
    title.trim().length >= 3 &&
    points >= 1 &&
    points <= 100 &&
    semester.trim().length > 0;

  return (
    <section className="card p-4" aria-labelledby="cc-recognition-h">
      <h2 id="cc-recognition-h" className="flex items-center gap-1.5 font-display text-sm font-bold">
        <Award size={15} className="text-violet-ink" /> Award Campus Honours
      </h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        Club-verified recognition only. The database rejects self-awards and keeps this separate
        from university verification.
      </p>

      {loading ? (
        <p className="mt-3 rounded-xl bg-campus-bg p-3 text-[11px] text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
          Loading approved members…
        </p>
      ) : !canAward ? (
        <p className="mt-3 rounded-xl bg-campus-bg p-3 text-[11px] text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
          Recognition is not enabled for this account.
        </p>
      ) : members.length === 0 ? (
        <p className="mt-3 rounded-xl bg-campus-bg p-3 text-[11px] text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
          Approve at least one other member before awarding recognition.
        </p>
      ) : (
        <form
          className="mt-3 space-y-2.5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canSubmit || isBusy) return;
            const input: RecognitionInput = {
              personId,
              personName,
              category,
              title: title.trim(),
              detail: detail.trim() || undefined,
              points,
              semester: semester.trim(),
            };
            if (!(await onBeforeSubmit(input))) return;
            setSubmitting(true);
            const result = await onAward({
              personId: input.personId,
              category: input.category,
              title: input.title,
              detail: input.detail,
              points: input.points,
              semester: input.semester,
            });
            setSubmitting(false);
            if (result.error) {
              pushToast(result.error, 'warning');
              return;
            }
            pushToast(`Club recognition awarded to ${personName}.`, 'success');
            setPersonId('');
            setTitle('');
            setDetail('');
            setPoints(10);
            onSuccess();
          }}
        >
          <label className="block text-[11px] font-bold">
            Member
            <select
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            >
              <option value="">Choose an approved member</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="block text-[11px] font-bold">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as HonourCategory)}
                className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
              >
                {HONOUR_CATEGORIES.map((honourCategory) => (
                  <option key={honourCategory} value={honourCategory}>
                    {honourCategory}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-bold">
              Semester
              <input
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
              />
            </label>
          </div>

          <label className="block text-[11px] font-bold">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What did they contribute?"
              required
              minLength={3}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>

          <label className="block text-[11px] font-bold">
            Detail <span className="font-normal text-campus-text-sec dark:text-campus-dark-sec">(optional)</span>
            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>

          <label className="block text-[11px] font-bold">
            Points (1–100)
            <input
              type="number"
              min={1}
              max={100}
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              className="mt-1 w-full rounded-xl border border-campus-border bg-white px-3 py-2 text-xs dark:border-campus-dark-border dark:bg-campus-dark-card"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit || isBusy}
            className="touch-target w-full rounded-xl bg-violet py-2.5 text-xs font-bold text-plum shadow-violet-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? 'Publishing…' : 'Publish recognition'}
          </button>
        </form>
      )}
    </section>
  );
}
