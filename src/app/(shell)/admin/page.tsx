'use client';

// ============================================================================
// NUBCONNECT — Admin command centre (PART 13/28)
// ----------------------------------------------------------------------------
// One administrative surface over the same Supabase data as the student app.
// Nothing here is a security boundary: every read and write calls a
// SECURITY DEFINER RPC that checks the caller's role first. This page only
// reflects what the database says the signed-in administrator may do.
// ============================================================================
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  BadgeCheck,
  Ban,
  Check,
  Database,
  FileText,
  Flag,
  HardDrive,
  History,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Newspaper,
  RotateCcw,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  ADMIN_PERMISSION_LABELS,
  ADMIN_ROLE_LABELS,
  archiveLaunchPost,
  can,
  formatBytes,
  formatCount,
  hasAnyAdminRole,
  loadAdminDashboard,
  loadAdminPages,
  loadAdminReports,
  loadAuditTrail,
  loadFeatureFlags,
  loadLaunchContent,
  moderatePost,
  resolveAdminReport,
  restoreLaunchPost,
  roleLabel,
  searchAdminUsers,
  setFeatureFlag,
  setPlatformAnnouncement,
  setStudentSuspension,
  setStudentVerification,
  type AdminAccess,
  type AdminAuditRow,
  type AdminDashboard,
  type AdminPageRow,
  type AdminPermission,
  type AdminReportRow,
  type AdminRole,
  type AdminUserRow,
  type FeatureFlagRow,
  type FeatureKey,
  type LaunchContentRow,
} from '@/lib/admin';
import {
  EDITORIAL_GROUPING_NOTE,
  EDITORIAL_REVIEW_NOTE,
  EDITORIAL_VERIFICATION_NOTE,
  MODERATION_SCOPE_NOTE,
  PAGES_READ_ONLY_NOTE,
  SCHEDULING_UNAVAILABLE,
  editorialActionFor,
  editorialPublicationLabel,
  editorialRightsLabel,
  editorialSourceLabel,
  editorialVerificationLabel,
  groupEditorialByMonth,
  moderationAvailability,
} from '@/lib/editorial';
import { Avatar, EmptyState, Modal, SectionHeading } from '@/components/ui/kit';

type Section = 'overview' | 'people' | 'launch' | 'content' | 'reports' | 'features' | 'audit';

interface SectionDef {
  key: Section;
  label: string;
  icon: React.ReactNode;
  permission: AdminPermission;
}

const SECTIONS: SectionDef[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} />, permission: 'audit.read' },
  { key: 'people', label: 'People', icon: <Users size={15} />, permission: 'users.view' },
  { key: 'launch', label: 'Launch content', icon: <FileText size={15} />, permission: 'audit.read' },
  { key: 'content', label: 'Content', icon: <Newspaper size={15} />, permission: 'audit.read' },
  { key: 'reports', label: 'Reports', icon: <Flag size={15} />, permission: 'reports.resolve' },
  { key: 'features', label: 'Features', icon: <ToggleRight size={15} />, permission: 'audit.read' },
  { key: 'audit', label: 'Audit trail', icon: <History size={15} />, permission: 'audit.read' },
];

const ROLES: AdminRole[] = [
  'super_admin',
  'admin',
  'moderator',
  'department_admin',
  'club_admin',
  'support_admin',
];

const REASON_MIN = 4;

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A labelled number. `null` means the metric could not be measured. */
function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number | null | undefined;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-campus-text-sec dark:text-campus-dark-sec">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums">{formatCount(value)}</p>
      {hint && (
        <p className="mt-0.5 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          {hint}
        </p>
      )}
    </div>
  );
}

function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
  children: React.ReactNode;
}) {
  const styles =
    tone === 'ok'
      ? 'bg-[#DCFCE7] text-[#166534] dark:bg-[#14351f] dark:text-[#86efac]'
      : tone === 'warn'
        ? 'bg-[#FEF3C7] text-[#92400E] dark:bg-[#3a2c0d] dark:text-[#fcd34d]'
        : tone === 'danger'
          ? 'bg-[#FEE2E2] text-[#991B1B] dark:bg-[#3a1414] dark:text-[#fca5a5]'
          : 'bg-campus-bg text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-sec dark:ring-campus-dark-border';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${styles}`}>
      {children}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'neutral',
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'neutral' | 'danger' | 'primary';
  disabled?: boolean;
}) {
  const styles =
    tone === 'primary'
      ? 'bg-violet text-plum shadow-violet-glow'
      : tone === 'danger'
        ? 'bg-[#FEE2E2] text-[#991B1B] ring-1 ring-[#FCA5A5] dark:bg-[#3a1414] dark:text-[#fca5a5] dark:ring-[#7f1d1d]'
        : 'bg-campus-bg text-campus-text ring-1 ring-campus-border dark:bg-campus-dark-elev dark:text-campus-dark-text dark:ring-campus-dark-border';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

interface ReasonRequest {
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
}

function ReasonDialog({
  request,
  onClose,
}: {
  request: ReasonRequest | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason('');
    setError(null);
  }, [request]);

  const submit = async () => {
    if (!request) return;
    if (reason.trim().length < REASON_MIN) {
      setError(`Write at least ${REASON_MIN} characters so the audit trail is useful.`);
      return;
    }
    setError(null);
    await request.onConfirm(reason.trim());
    onClose();
  };

  return (
    <Modal open={Boolean(request)} onClose={onClose} title={request?.title ?? 'Confirm action'}>
      {request && (
        <div className="space-y-3 pb-1">
          {request.body && (
            <p className="text-xs leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {request.body}
            </p>
          )}
          <label className="block text-[11px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
            Reason (stored in the audit trail)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 w-full resize-none rounded-xl bg-campus-bg px-3 py-2 text-sm font-medium text-campus-text outline-none ring-1 ring-campus-border focus:ring-2 focus:ring-violet dark:bg-campus-dark-elev dark:text-campus-dark-text dark:ring-campus-dark-border"
              placeholder="Why is this action being taken?"
            />
          </label>
          {error && (
            <p className="flex items-start gap-1.5 text-[11px] font-semibold text-[#B91C1C] dark:text-[#fca5a5]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-xs font-bold text-campus-text-sec ring-1 ring-campus-border dark:text-campus-dark-sec dark:ring-campus-dark-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
                request.danger ? 'bg-[#B91C1C] text-white' : 'bg-violet text-plum shadow-violet-glow'
              }`}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Batch chips shared by the existing Launch list and the new Content review. */
function BatchFilter({
  batches,
  selected,
  onSelect,
}: {
  batches: string[];
  selected: string | null;
  onSelect: (batch: string | null) => void;
}) {
  const idle =
    'bg-campus-card text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border';
  const active = 'bg-[#211B35] text-white';
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto" role="group" aria-label="Filter launch content by seed batch">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${selected === null ? active : idle}`}
      >
        All batches
      </button>
      {batches.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${selected === value ? active : idle}`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

/** One seed/launch post, rendered only from RPC fields. */
function EditorialCard({
  row,
  canModerate,
  isSuperAdmin,
  onArchive,
  onRestore,
}: {
  row: LaunchContentRow;
  canModerate: boolean;
  isSuperAdmin: boolean;
  onArchive: (row: LaunchContentRow) => void;
  onRestore: (row: LaunchContentRow) => void;
}) {
  const availability = moderationAvailability(row, { canModerate, isSuperAdmin });
  const primary = editorialActionFor(row);
  const unavailable = Array.from(
    new Set(
      [availability.archive.reason, availability.restore.reason].filter((reason): reason is string => Boolean(reason)),
    ),
  );

  return (
    <li className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold">{row.title ?? 'Untitled launch post'}</p>
            <Badge tone={row.is_hidden || row.publication_status === 'archived' ? 'danger' : 'ok'}>
              {editorialPublicationLabel(row)}
            </Badge>
            {!row.removal_eligible && <Badge tone="warn">Protected</Badge>}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            {row.body_preview}
          </p>
        </div>
      </div>

      <dl className="mt-2.5 grid gap-x-4 gap-y-1 border-t border-campus-border pt-2.5 text-[10.5px] dark:border-campus-dark-border sm:grid-cols-2">
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Source:</dt>
          <dd className="truncate">{editorialSourceLabel(row)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Rights:</dt>
          <dd className="truncate">{editorialRightsLabel(row)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Verification / review:</dt>
          <dd className="truncate">{editorialVerificationLabel(row)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Status:</dt>
          <dd className="truncate">{editorialPublicationLabel(row)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Original published:</dt>
          <dd className="truncate">
            {row.original_published_at ? formatWhen(row.original_published_at) : 'Not recorded'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Imported:</dt>
          <dd className="truncate">{formatWhen(row.created_at)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Page:</dt>
          <dd className="truncate">{row.page_name ?? '—'}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Batch:</dt>
          <dd className="truncate">{row.seed_batch ?? '—'}</dd>
        </div>
      </dl>

      {row.source_url && (
        <a
          href={row.source_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 inline-block max-w-full truncate text-[10.5px] font-semibold text-violet-ink hover:underline"
        >
          {row.source_url}
        </a>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-campus-border pt-2.5 dark:border-campus-dark-border">
        <ActionButton
          tone={primary === 'archive' ? 'danger' : 'neutral'}
          disabled={!availability.archive.allowed}
          onClick={() => onArchive(row)}
        >
          <Archive size={12} /> Archive
        </ActionButton>
        <ActionButton
          tone={primary === 'restore' ? 'primary' : 'neutral'}
          disabled={!availability.restore.allowed}
          onClick={() => onRestore(row)}
        >
          <RotateCcw size={12} /> Restore
        </ActionButton>
      </div>
      {unavailable.length > 0 && (
        <p className="mt-1.5 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          Unavailable: {unavailable.join(' · ')}
        </p>
      )}
      <p className="mt-1 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
        {MODERATION_SCOPE_NOTE}
      </p>
    </li>
  );
}

function AccessGate({ access, signedIn }: { access: AdminAccess; signedIn: boolean }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-soft text-violet-ink dark:bg-violet-dark-soft">
        <ShieldCheck size={24} />
      </span>
      <h1 className="mt-4 font-display text-xl font-extrabold">Staff command centre</h1>
      <p className="mt-2 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        {signedIn
          ? 'This area is limited to authorized university staff. Your account does not currently hold an administrative role.'
          : 'Sign in with an administrator account to open the command centre. Students never see this area.'}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Link
          href={signedIn ? '/home' : '/auth/login'}
          className="rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-plum shadow-violet-glow"
        >
          {signedIn ? 'Back to Home' : 'Sign in'}
        </Link>
      </div>
      {signedIn && access.roles.length === 0 && (
        <p className="mt-4 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          Roles are granted by a Super Admin and recorded in the audit trail.
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const {
    authLoading,
    user,
    adminAccess,
    refreshAdminAccess,
    platformFlags,
    refreshPlatformFlags,
    pushToast,
  } = useApp();
  const supabase = getSupabaseBrowserClient();

  const [section, setSection] = useState<Section>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [people, setPeople] = useState<AdminUserRow[]>([]);
  const [personQuery, setPersonQuery] = useState('');
  const [peopleSearched, setPeopleSearched] = useState(false);
  const [launch, setLaunch] = useState<LaunchContentRow[]>([]);
  const [batch, setBatch] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<'editorial' | 'pages'>('editorial');
  const [pages, setPages] = useState<AdminPageRow[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [reportStatus, setReportStatus] = useState<string | null>('open');
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null);

  const canRead = can(adminAccess, 'audit.read');
  const canView = can(adminAccess, 'users.view');
  const canModerate = can(adminAccess, 'content.moderate');
  const canVerify = can(adminAccess, 'users.verify');
  const canSuspend = can(adminAccess, 'users.suspend');
  const canRoles = can(adminAccess, 'roles.manage');
  const canFeatures = can(adminAccess, 'features.manage');
  const canReports = can(adminAccess, 'reports.resolve');

  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => adminAccess.is_admin && adminAccess.permissions[s.permission]),
    [adminAccess],
  );

  // Pure grouping: review buckets from recorded dates, never a schedule.
  const editorialGroups = useMemo(() => groupEditorialByMonth(launch), [launch]);

  const run = useCallback(
    async (fn: () => Promise<string | null | void>, success?: string) => {
      setBusy(true);
      setError(null);
      try {
        const message = await fn();
        if (message) {
          setError(message);
          pushToast(message, 'warning');
        } else if (success) {
          pushToast(success, 'success');
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong';
        setError(message);
        pushToast(message, 'warning');
      } finally {
        setBusy(false);
      }
    },
    [pushToast],
  );

  // --- Loaders -------------------------------------------------------------
  const loadOverview = useCallback(async () => {
    if (!supabase || !canRead) return;
    const result = await loadAdminDashboard(supabase);
    if (result.error) setError(result.error);
    else setDashboard(result.data);
  }, [supabase, canRead]);

  const loadPeople = useCallback(
    async (query = '') => {
      if (!supabase || !canView) return;
      const result = await searchAdminUsers(supabase, query);
      if (result.error) setError(result.error);
      else setPeople(result.data ?? []);
      setPeopleSearched(true);
    },
    [supabase, canView],
  );

  const loadLaunch = useCallback(
    async (selected: string | null) => {
      if (!supabase || !canRead) return;
      const result = await loadLaunchContent(supabase, selected);
      if (result.error) setError(result.error);
      else setLaunch(result.data ?? []);
    },
    [supabase, canRead],
  );

  const loadPages = useCallback(async () => {
    if (!supabase || !canRead) return;
    const result = await loadAdminPages(supabase);
    if (result.error) setError(result.error);
    else setPages(result.data ?? []);
  }, [supabase, canRead]);

  const loadReports = useCallback(
    async (status: string | null) => {
      if (!supabase || !canReports) return;
      const result = await loadAdminReports(supabase, status);
      if (result.error) setError(result.error);
      else setReports(result.data ?? []);
    },
    [supabase, canReports],
  );

  const loadFlags = useCallback(async () => {
    if (!supabase || !canRead) return;
    const result = await loadFeatureFlags(supabase);
    if (result.error) setError(result.error);
    else setFlags(result.data ?? []);
  }, [supabase, canRead]);

  const loadAudit = useCallback(async () => {
    if (!supabase || !canRead) return;
    const result = await loadAuditTrail(supabase);
    if (result.error) setError(result.error);
    else setAudit(result.data ?? []);
  }, [supabase, canRead]);

  useEffect(() => {
    if (authLoading || !adminAccess.is_admin) return;
    if (section === 'overview') void loadOverview();
    if (section === 'people' && !peopleSearched) void loadPeople('');
    if (section === 'launch') void loadLaunch(batch);
    if (section === 'content' && contentTab === 'editorial') void loadLaunch(batch);
    if (section === 'content' && contentTab === 'pages') void loadPages();
    if (section === 'reports') void loadReports(reportStatus);
    if (section === 'features') void loadFlags();
    if (section === 'audit') void loadAudit();
  }, [
    authLoading,
    adminAccess.is_admin,
    section,
    batch,
    contentTab,
    reportStatus,
    peopleSearched,
    loadOverview,
    loadPeople,
    loadLaunch,
    loadPages,
    loadReports,
    loadFlags,
    loadAudit,
  ]);

  useEffect(() => {
    if (platformFlags.announcement) setAnnouncementDraft(platformFlags.announcement.message);
  }, [platformFlags.announcement]);

  // A role without the current section's permission falls back to the first
  // section it can actually read.
  useEffect(() => {
    if (!visibleSections.some((s) => s.key === section) && visibleSections.length > 0) {
      setSection(visibleSections[0].key);
    }
  }, [section, visibleSections]);

  if (authLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-16 text-sm font-semibold text-campus-text-sec dark:text-campus-dark-sec">
        <Loader2 size={16} className="animate-spin" /> Checking your access…
      </div>
    );
  }

  if (!supabase || !hasAnyAdminRole(adminAccess)) {
    return <AccessGate access={adminAccess} signedIn={Boolean(user?.id && !user.isDemo)} />;
  }

  const batches = Array.from(new Set(launch.map((row) => row.seed_batch).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-6xl px-0 pb-10 sm:px-1">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl bg-editorial-night px-4 py-4 text-white sm:px-5">
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-editorial-violet/20 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="editorial-kicker flex items-center gap-1.5 text-editorial-lime/80">
              <ShieldCheck size={12} /> Staff only
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
              <span className="text-[9px] tracking-normal text-white/50">server-authorized</span>
            </p>
            <h1 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">Command centre</h1>
            <p className="mt-0.5 text-[11px] font-semibold text-white/60">
              {user.name} · {adminAccess.roles.map(roleLabel).join(' · ') || 'Administrator'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {adminAccess.roles.slice(0, 3).map((role) => (
              <span key={role} className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/80">
                {ADMIN_ROLE_LABELS[role]}
              </span>
            ))}
            <button
              type="button"
              onClick={() => void refreshAdminAccess()}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80 hover:bg-white/15"
            >
              Refresh access
            </button>
          </div>
        </div>
      </section>

      {/* Section nav */}
      <nav className="no-scrollbar mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-campus-card p-1 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
        {visibleSections.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition ${
              section === item.key
                ? 'bg-[#211B35] text-white shadow-sm'
                : 'text-campus-text-sec hover:bg-campus-bg dark:text-campus-dark-sec dark:hover:bg-campus-dark-elev'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2 text-[11px] font-semibold text-[#991B1B] dark:bg-[#3a1414] dark:text-[#fca5a5]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {busy && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          <Loader2 size={13} className="animate-spin" /> Working…
        </p>
      )}

      {/* OVERVIEW */}
      {section === 'overview' && (
        <div className="mt-4 space-y-4">
          {!dashboard ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              <Loader2 size={15} className="animate-spin" /> Reading the platform…
            </p>
          ) : (
            <>
              <div>
                <SectionHeading icon={<Users size={15} />} title="People" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  <Stat label="Registered students" value={dashboard.people.registered_students} icon={<Users size={11} />} />
                  <Stat label="NUB Verified" value={dashboard.people.verified_students} icon={<BadgeCheck size={11} />} />
                  <Stat label="New in 7 days" value={dashboard.people.new_students_7d} />
                  <Stat label="Active in 30 days" value={dashboard.people.active_30d} hint="From sign-in records" />
                  <Stat label="Suspended" value={dashboard.people.suspended_accounts} icon={<Ban size={11} />} />
                  <Stat label="Administrators" value={dashboard.people.administrators} icon={<ShieldCheck size={11} />} />
                  <Stat label="Unconfirmed signups" value={dashboard.people.unconfirmed_signups} />
                </div>
              </div>

              <div>
                <SectionHeading icon={<FileText size={15} />} title="Content & communities" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  <Stat label="Posts" value={dashboard.content.posts} />
                  <Stat label="Comments" value={dashboard.content.comments} />
                  <Stat label="Reactions" value={dashboard.content.reactions} />
                  <Stat label="Launch posts" value={dashboard.content.launch_posts} icon={<Archive size={11} />} />
                  <Stat label="Active Pages" value={dashboard.content.pages} />
                  <Stat label="Page followers" value={dashboard.content.page_followers} />
                  <Stat label="Clubs" value={dashboard.content.clubs} />
                  <Stat label="Club memberships" value={dashboard.content.club_memberships} />
                  <Stat label="Events" value={dashboard.content.events} />
                  <Stat label="Marketplace" value={dashboard.content.marketplace_listings} />
                  <Stat label="Room listings" value={dashboard.content.room_listings} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <SectionHeading icon={<Activity size={15} />} title="Campus Pulse" />
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Available now" value={dashboard.pulse.available_now} />
                    <Stat label="Open activities" value={dashboard.pulse.open_activities} />
                    <Stat label="Reported" value={dashboard.pulse.reported_activities} />
                  </div>
                </div>
                <div>
                  <SectionHeading icon={<Flag size={15} />} title="Moderation queue" />
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Reports" value={dashboard.moderation.pending_reports} />
                    <Stat label="Student reviews" value={dashboard.moderation.pending_student_verifications} />
                    <Stat label="Club reviews" value={dashboard.moderation.pending_club_verifications} />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <SectionHeading icon={<HardDrive size={15} />} title="Storage" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">Total</p>
                      <p className="mt-1 font-display text-lg font-extrabold">{formatBytes(dashboard.storage.bytes_total)}</p>
                    </div>
                    <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">7 days</p>
                      <p className="mt-1 font-display text-lg font-extrabold">{formatBytes(dashboard.storage.bytes_uploaded_7d)}</p>
                    </div>
                    <Stat label="Large files" value={dashboard.storage.large_files} hint="Over 5 MB" />
                  </div>
                </div>
                <div>
                  <SectionHeading icon={<Database size={15} />} title="Health" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">Database</p>
                      <p className="mt-1 font-display text-lg font-extrabold">{formatBytes(dashboard.health.database_bytes)}</p>
                    </div>
                    <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">Server time</p>
                      <p className="mt-1 text-xs font-bold">{formatWhen(dashboard.health.server_time)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                <p className="flex items-center gap-1.5 text-[11px] font-bold">
                  <AlertTriangle size={13} className="text-[#B45309] dark:text-[#fcd34d]" /> Not measured — shown honestly
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                  {dashboard.unavailable.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* PEOPLE */}
      {section === 'people' && (
        <div className="mt-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadPeople(personQuery);
            }}
            className="flex gap-2"
          >
            <label className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-campus-text-sec dark:text-campus-dark-sec" />
              <input
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Search name, username or email"
                className="w-full rounded-xl bg-campus-card py-2.5 pl-9 pr-3 text-sm font-medium ring-1 ring-campus-border outline-none focus:ring-2 focus:ring-violet dark:bg-campus-dark-card dark:ring-campus-dark-border"
              />
            </label>
            <button type="submit" className="rounded-xl bg-[#211B35] px-4 py-2 text-xs font-bold text-white">
              Search
            </button>
          </form>

          {people.length === 0 && peopleSearched ? (
            <EmptyState icon={<Users size={20} />} title="No students match" body="Try a different name, username or email." />
          ) : (
            <ul className="space-y-2">
              {people.map((person) => (
                <li
                  key={person.id}
                  className="rounded-2xl bg-campus-card p-3 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Avatar seed={person.id} name={person.display_name} src={person.avatar_url} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold">{person.display_name}</p>
                        {person.is_verified_student && <Badge tone="ok"><BadgeCheck size={10} /> Verified</Badge>}
                        {person.is_suspended && <Badge tone="danger"><Ban size={10} /> Suspended</Badge>}
                        {person.roles.map((role) => (
                          <Badge key={role} tone="warn">{roleLabel(role)}</Badge>
                        ))}
                      </div>
                      <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
                        @{person.username}
                        {person.email ? ` · ${person.email}` : ''}
                        {person.department_name ? ` · ${person.department_name}` : ''}
                      </p>
                      <p className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                        Joined {formatWhen(person.created_at)} · Last sign-in {formatWhen(person.last_sign_in_at)}
                      </p>
                    </div>
                  </div>

                  {(canVerify || canSuspend || canRoles) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-campus-border pt-2.5 dark:border-campus-dark-border">
                      {canVerify && (
                        <ActionButton
                          tone={person.is_verified_student ? 'neutral' : 'primary'}
                          onClick={() =>
                            setReasonRequest({
                              title: person.is_verified_student ? 'Remove NUB Verified status' : 'Approve NUB Verified status',
                              body: `${person.display_name} (@${person.username}) — this decision is recorded with your name.`,
                              confirmLabel: person.is_verified_student ? 'Remove verification' : 'Approve verification',
                              danger: person.is_verified_student,
                              onConfirm: async (reason) => {
                                await run(async () => {
                                  const message = await setStudentVerification(supabase, person.id, !person.is_verified_student, reason);
                                  if (!message) await loadPeople(personQuery);
                                  return message;
                                }, person.is_verified_student ? 'Verification removed' : 'Student verified');
                              },
                            })
                          }
                        >
                          <BadgeCheck size={12} />
                          {person.is_verified_student ? 'Remove verification' : 'Verify student'}
                        </ActionButton>
                      )}
                      {canSuspend && (
                        <ActionButton
                          tone={person.is_suspended ? 'neutral' : 'danger'}
                          onClick={() =>
                            setReasonRequest({
                              title: person.is_suspended ? 'Restore this account' : 'Suspend this account',
                              body: `${person.display_name} (@${person.username}). A suspended account cannot sign in or interact.`,
                              confirmLabel: person.is_suspended ? 'Restore account' : 'Suspend account',
                              danger: !person.is_suspended,
                              onConfirm: async (reason) => {
                                await run(async () => {
                                  const message = await setStudentSuspension(supabase, person.id, !person.is_suspended, reason);
                                  if (!message) await loadPeople(personQuery);
                                  return message;
                                }, person.is_suspended ? 'Account restored' : 'Account suspended');
                              },
                            })
                          }
                        >
                          {person.is_suspended ? <RotateCcw size={12} /> : <Ban size={12} />}
                          {person.is_suspended ? 'Restore' : 'Suspend'}
                        </ActionButton>
                      )}
                      {canRoles && (
                        <RoleControls
                          person={person}
                          onGrant={(role) =>
                            setReasonRequest({
                              title: `Grant ${ADMIN_ROLE_LABELS[role]}`,
                              body: `${person.display_name} will gain the ${ADMIN_ROLE_LABELS[role]} role immediately.`,
                              confirmLabel: 'Grant role',
                              onConfirm: async (reason) => {
                                await run(async () => {
                                  const message = await assignRoleSafe(supabase, person.id, role, true, reason);
                                  if (!message) await loadPeople(personQuery);
                                  return message;
                                }, `${ADMIN_ROLE_LABELS[role]} granted`);
                              },
                            })
                          }
                          onRevoke={(role) =>
                            setReasonRequest({
                              title: `Revoke ${ADMIN_ROLE_LABELS[role]}`,
                              body: `${person.display_name} will lose the ${ADMIN_ROLE_LABELS[role]} role.`,
                              confirmLabel: 'Revoke role',
                              danger: true,
                              onConfirm: async (reason) => {
                                await run(async () => {
                                  const message = await assignRoleSafe(supabase, person.id, role, false, reason);
                                  if (!message) await loadPeople(personQuery);
                                  return message;
                                }, `${ADMIN_ROLE_LABELS[role]} revoked`);
                              },
                            })
                          }
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* LAUNCH CONTENT */}
      {section === 'launch' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
            <p className="text-[11px] font-bold">Attributable launch content</p>
            <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Every row keeps its source, rights, reviewer and seed batch. Archiving hides it from students and keeps the
              audit record; student posts are never mixed into this list.
            </p>
          </div>

          <BatchFilter
            batches={batches}
            selected={batch}
            onSelect={(value) => {
              setBatch(value);
              void loadLaunch(value);
            }}
          />

          {launch.length === 0 ? (
            <EmptyState icon={<FileText size={20} />} title="No launch content" body="This batch has no seed posts yet." />
          ) : (
            <ul className="space-y-2">
              {launch.map((row) => (
                <li key={row.id} className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-bold">{row.title ?? 'Untitled launch post'}</p>
                        <Badge tone={row.is_hidden ? 'danger' : 'ok'}>{row.publication_status}</Badge>
                        {!row.removal_eligible && <Badge tone="warn">Protected</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                        {row.body_preview}
                      </p>
                    </div>
                    {canModerate && (
                      <ActionButton
                        tone={row.is_hidden ? 'neutral' : 'danger'}
                        onClick={() =>
                          setReasonRequest({
                            title: row.is_hidden ? 'Restore this launch post' : 'Archive this launch post',
                            body: row.is_hidden
                              ? 'The post becomes visible to students again.'
                              : 'The post disappears from student surfaces. The audit trail keeps who removed it and why.',
                            confirmLabel: row.is_hidden ? 'Restore' : 'Archive',
                            danger: !row.is_hidden,
                            onConfirm: async (reason) => {
                              await run(async () => {
                                const message = await moderatePost(supabase, row.id, row.is_hidden ? 'restore' : 'archive', reason);
                                if (!message) await loadLaunch(batch);
                                return message;
                              }, row.is_hidden ? 'Launch post restored' : 'Launch post archived');
                            },
                          })
                        }
                      >
                        {row.is_hidden ? <RotateCcw size={12} /> : <Archive size={12} />}
                        {row.is_hidden ? 'Restore' : 'Archive'}
                      </ActionButton>
                    )}
                  </div>

                  <dl className="mt-2.5 grid gap-x-4 gap-y-1 border-t border-campus-border pt-2.5 text-[10.5px] dark:border-campus-dark-border sm:grid-cols-2">
                    <div className="flex gap-1">
                      <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Page:</dt>
                      <dd className="truncate">{row.page_name ?? '—'}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Batch:</dt>
                      <dd className="truncate">{row.seed_batch ?? '—'}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Source:</dt>
                      <dd className="truncate">{row.source_organization ?? '—'}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Rights:</dt>
                      <dd className="truncate">{row.content_rights ?? '—'}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Reviewer:</dt>
                      <dd className="truncate">{row.internal_reviewer ?? '—'}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-bold text-campus-text-sec dark:text-campus-dark-sec">Original:</dt>
                      <dd className="truncate">{formatWhen(row.original_published_at ?? row.created_at)}</dd>
                    </div>
                  </dl>

                  {row.source_url && (
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1.5 inline-block truncate text-[10.5px] font-semibold text-violet-ink hover:underline"
                    >
                      {row.source_url}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* CONTENT / EDITORIAL */}
      {section === 'content' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
            <p className="flex items-center gap-1.5 text-[11px] font-bold">
              <Newspaper size={13} /> Editorial review
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {EDITORIAL_REVIEW_NOTE}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {EDITORIAL_VERIFICATION_NOTE}
            </p>
          </div>

          <div className="no-scrollbar flex gap-1 overflow-x-auto" role="tablist" aria-label="Content views">
            {([
              ['editorial', 'Editorial review'],
              ['pages', 'Pages (read-only)'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={contentTab === key}
                onClick={() => setContentTab(key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  contentTab === key
                    ? 'bg-[#211B35] text-white'
                    : 'bg-campus-card text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {contentTab === 'editorial' && (
            <>
              <BatchFilter
                batches={batches}
                selected={batch}
                onSelect={(value) => {
                  setBatch(value);
                  void loadLaunch(value);
                }}
              />

              <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                <p className="flex items-center gap-1.5 text-[11px] font-bold">
                  <AlertTriangle size={13} className="text-[#B45309] dark:text-[#fcd34d]" /> Requires backend support
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                  {SCHEDULING_UNAVAILABLE}
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                  {EDITORIAL_GROUPING_NOTE}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ActionButton disabled onClick={() => undefined}>
                    Schedule publish date
                  </ActionButton>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                    Requires backend support
                  </span>
                </div>
              </div>

              {launch.length === 0 ? (
                <EmptyState
                  icon={<Newspaper size={20} />}
                  title="No editorial content"
                  body="This batch has no seed posts returned by the launch-content RPC."
                />
              ) : (
                <div className="space-y-4">
                  {editorialGroups.map((group) => (
                    <section key={group.key} aria-label={`Editorial review: ${group.label}`}>
                      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 px-1">
                        <h3 className="font-display text-[13px] font-bold">{group.label}</h3>
                        <span className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                          {group.rows.length} {group.rows.length === 1 ? 'item' : 'items'} · review view, not a publish slot
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {group.rows.map((row) => (
                          <EditorialCard
                            key={row.id}
                            row={row}
                            canModerate={canModerate}
                            isSuperAdmin={adminAccess.is_super_admin}
                            onArchive={(item) =>
                              setReasonRequest({
                                title: 'Archive this launch post',
                                body: 'The post disappears from student surfaces. The audit trail records who removed it and why.',
                                confirmLabel: 'Archive',
                                danger: true,
                                onConfirm: async (reason) => {
                                  await run(async () => {
                                    const message = await archiveLaunchPost(supabase, item.id, reason);
                                    if (!message) await loadLaunch(batch);
                                    return message;
                                  }, 'Launch post archived');
                                },
                              })
                            }
                            onRestore={(item) =>
                              setReasonRequest({
                                title: 'Restore this launch post',
                                body: 'The post becomes visible to students again. The decision is recorded in the audit trail.',
                                confirmLabel: 'Restore',
                                onConfirm: async (reason) => {
                                  await run(async () => {
                                    const message = await restoreLaunchPost(supabase, item.id, reason);
                                    if (!message) await loadLaunch(batch);
                                    return message;
                                  }, 'Launch post restored');
                                },
                              })
                            }
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}

          {contentTab === 'pages' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                <p className="text-[11px] font-bold">Active Pages</p>
                <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                  {PAGES_READ_ONLY_NOTE}
                </p>
              </div>

              {pages.length === 0 ? (
                <EmptyState
                  icon={<FileText size={20} />}
                  title="No active Pages returned"
                  body="RLS exposes active Pages only. Nothing is cached or invented here."
                />
              ) : (
                <ul className="space-y-2">
                  {pages.map((page) => (
                    <li
                      key={page.id}
                      className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{page.name}</p>
                          <p className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                            /{page.slug} · {titleCase(page.kind)}
                          </p>
                          {page.description && (
                            <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                              {page.description}
                            </p>
                          )}
                        </div>
                        <Badge tone="neutral">{titleCase(page.verification_status)}</Badge>
                      </div>
                      <p className="mt-1.5 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                        Active · {page.id.slice(0, 8)}…
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                <p className="flex items-center gap-1.5 text-[11px] font-bold">
                  <AlertTriangle size={13} className="text-[#B45309] dark:text-[#fcd34d]" /> Requires backend support
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                  No admin RPC enforces ownership transfer, Page approval or leadership changes. These controls stay disabled
                  rather than pretending the database would accept them.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ActionButton disabled onClick={() => undefined}>Transfer ownership</ActionButton>
                  <ActionButton disabled onClick={() => undefined}>Approve verification</ActionButton>
                  <ActionButton disabled onClick={() => undefined}>Change leadership</ActionButton>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORTS */}
      {section === 'reports' && (
        <div className="mt-4 space-y-3">
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {[
              { key: 'open', label: 'Open' },
              { key: 'under_review', label: 'Under review' },
              { key: 'resolved', label: 'Resolved' },
              { key: 'dismissed', label: 'Dismissed' },
              { key: null, label: 'All' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  setReportStatus(option.key);
                  void loadReports(option.key);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  reportStatus === option.key
                    ? 'bg-[#211B35] text-white'
                    : 'bg-campus-card text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {reports.length === 0 ? (
            <EmptyState icon={<Flag size={20} />} title="Nothing in this queue" body="Reports appear here as students submit them." />
          ) : (
            <ul className="space-y-2">
              {reports.map((report) => (
                <li key={report.id} className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={report.status === 'open' ? 'warn' : 'neutral'}>{titleCase(report.status)}</Badge>
                    <span className="text-xs font-bold">{titleCase(report.reason_category)}</span>
                    <span className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      {report.target_type} · {report.target_id.slice(0, 8)}…
                    </span>
                  </div>
                  {report.details && (
                    <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">{report.details}</p>
                  )}
                  <p className="mt-1 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    Reported by {report.reporter_name} (@{report.reporter_username}) · {formatWhen(report.created_at)}
                  </p>
                  {canReports && report.status !== 'resolved' && report.status !== 'dismissed' && (
                    <div className="mt-2 flex gap-1.5 border-t border-campus-border pt-2 dark:border-campus-dark-border">
                      <ActionButton
                        tone="primary"
                        onClick={() =>
                          setReasonRequest({
                            title: 'Resolve this report',
                            body: 'Record what was decided. The reporter is not shown your private note.',
                            confirmLabel: 'Resolve',
                            onConfirm: async (reason) => {
                              await run(async () => {
                                const message = await resolveAdminReport(supabase, report.id, 'resolved', reason);
                                if (!message) await loadReports(reportStatus);
                                return message;
                              }, 'Report resolved');
                            },
                          })
                        }
                      >
                        <Check size={12} /> Resolve
                      </ActionButton>
                      <ActionButton
                        onClick={() =>
                          setReasonRequest({
                            title: 'Dismiss this report',
                            body: 'Dismiss only when the report does not need action.',
                            confirmLabel: 'Dismiss',
                            onConfirm: async (reason) => {
                              await run(async () => {
                                const message = await resolveAdminReport(supabase, report.id, 'dismissed', reason);
                                if (!message) await loadReports(reportStatus);
                                return message;
                              }, 'Report dismissed');
                            },
                          })
                        }
                      >
                        <X size={12} /> Dismiss
                      </ActionButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* FEATURES */}
      {section === 'features' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
            <p className="flex items-center gap-1.5 text-[11px] font-bold">
              <ToggleRight size={13} /> Feature availability
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Only switches the student app actually enforces appear here. Every change requires a reason and is audited.
            </p>
          </div>

          <ul className="space-y-2">
            {flags.map((flag) => (
              <li
                key={flag.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    {flag.enabled ? <ToggleRight size={14} className="text-[#15803D]" /> : <ToggleLeft size={14} className="text-campus-text-sec" />}
                    {titleCase(flag.key)}
                    <Badge tone={flag.enabled ? 'ok' : 'neutral'}>{flag.enabled ? 'On' : 'Off'}</Badge>
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                    {flag.description}
                  </p>
                  <p className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                    Updated {formatWhen(flag.updated_at)}
                  </p>
                </div>
                {canFeatures && (
                  <ActionButton
                    tone={flag.enabled ? 'danger' : 'primary'}
                    onClick={() =>
                      setReasonRequest({
                        title: `${flag.enabled ? 'Disable' : 'Enable'} ${titleCase(flag.key)}`,
                        body:
                          flag.enabled
                            ? 'Students immediately lose access to this surface.'
                            : 'The surface becomes available to students again.',
                        confirmLabel: flag.enabled ? 'Disable' : 'Enable',
                        danger: flag.enabled,
                        onConfirm: async (reason) => {
                          await run(async () => {
                            const message = await setFeatureFlag(supabase, flag.key as FeatureKey, !flag.enabled, reason);
                            if (!message) {
                              await loadFlags();
                              await refreshPlatformFlags();
                            }
                            return message;
                          }, `${titleCase(flag.key)} ${flag.enabled ? 'disabled' : 'enabled'}`);
                        },
                      })
                    }
                  >
                    {flag.enabled ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
                    {flag.enabled ? 'Disable' : 'Enable'}
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>

          <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
            <p className="flex items-center gap-1.5 text-[11px] font-bold">
              <Megaphone size={13} /> Platform announcement
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Shown at the top of the app for every student. Leave it empty to clear it.
            </p>
            <textarea
              value={announcementDraft}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
              rows={2}
              maxLength={240}
              placeholder="e.g. Mid-term schedules are now published on the Academic page."
              className="mt-2 w-full resize-none rounded-xl bg-campus-bg px-3 py-2 text-sm font-medium ring-1 ring-campus-border outline-none focus:ring-2 focus:ring-violet dark:bg-campus-dark-elev dark:ring-campus-dark-border"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ActionButton
                tone="primary"
                disabled={!canFeatures}
                onClick={() =>
                  setReasonRequest({
                    title: 'Publish announcement',
                    body: 'Every signed-in student sees this at the top of the app.',
                    confirmLabel: 'Publish',
                    onConfirm: async (reason) => {
                      await run(async () => {
                        const message = await setPlatformAnnouncement(supabase, announcementDraft, true, reason);
                        if (!message) await refreshPlatformFlags();
                        return message;
                      }, 'Announcement published');
                    },
                  })
                }
              >
                <Megaphone size={12} /> Publish
              </ActionButton>
              <ActionButton
                disabled={!canFeatures}
                onClick={() =>
                  setReasonRequest({
                    title: 'Clear announcement',
                    body: 'The banner disappears for every student.',
                    confirmLabel: 'Clear',
                    onConfirm: async (reason) => {
                      await run(async () => {
                        const message = await setPlatformAnnouncement(supabase, '', false, reason);
                        if (!message) {
                          setAnnouncementDraft('');
                          await refreshPlatformFlags();
                        }
                        return message;
                      }, 'Announcement cleared');
                    },
                  })
                }
              >
                <X size={12} /> Clear
              </ActionButton>
            </div>
            {platformFlags.announcement && (
              <p className="mt-2 rounded-lg bg-violet-soft px-2.5 py-1.5 text-[10.5px] font-semibold text-violet-ink dark:bg-violet-dark-soft">
                Live now: {platformFlags.announcement.message}
              </p>
            )}
            {!canFeatures && (
              <p className="mt-2 text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                Only a Super Admin can change platform features or announcements.
              </p>
            )}
          </div>
        </div>
      )}

      {/* AUDIT */}
      {section === 'audit' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
            <p className="flex items-center gap-1.5 text-[11px] font-bold">
              <History size={13} /> Append-only history
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              Records cannot be edited or deleted from the app — the database rejects UPDATE and DELETE on the audit table.
            </p>
          </div>

          {audit.length === 0 ? (
            <EmptyState icon={<History size={20} />} title="No administrative actions yet" body="Verification, moderation and feature changes will appear here." />
          ) : (
            <ol className="space-y-1.5">
              {audit.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-campus-card px-3 py-2.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border"
                >
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-bold">
                      {titleCase(row.action_type)}
                      <span className="ml-1 font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                        → {row.target_table}
                      </span>
                    </p>
                    {row.reason && (
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
                        {row.reason}
                      </p>
                    )}
                    <p className="text-[10px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                      {row.actor_name} · {roleLabel(row.actor_role)} · {formatWhen(row.created_at)}
                    </p>
                  </div>
                  <code className="rounded bg-campus-bg px-1.5 py-0.5 text-[9px] font-semibold text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec">
                    {row.target_record_id.slice(0, 18)}
                  </code>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <ReasonDialog request={reasonRequest} onClose={() => setReasonRequest(null)} />

      {/* Permission legend — tells staff what their role can do. */}
      <details className="mt-5 rounded-2xl bg-campus-card p-3.5 ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
        <summary className="cursor-pointer text-[11px] font-bold">What your role can do</summary>
        <ul className="mt-2 grid gap-1 text-[10.5px] font-semibold text-campus-text-sec dark:text-campus-dark-sec sm:grid-cols-2">
          {(Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermission[]).map((permission) => (
            <li key={permission} className="flex items-center gap-1.5">
              {adminAccess.permissions[permission] ? (
                <Check size={11} className="text-[#15803D]" />
              ) : (
                <X size={11} className="text-campus-text-sec" />
              )}
              {ADMIN_PERMISSION_LABELS[permission]}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Role select + grant/revoke buttons for one student. */
function RoleControls({
  person,
  onGrant,
  onRevoke,
}: {
  person: AdminUserRow;
  onGrant: (role: AdminRole) => void;
  onRevoke: (role: AdminRole) => void;
}) {
  const [selected, setSelected] = useState<AdminRole>('moderator');
  const current = person.roles.filter((role): role is AdminRole => ROLES.includes(role as AdminRole));
  const already = current.includes(selected);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value as AdminRole)}
        className="rounded-lg bg-campus-bg px-2 py-1.5 text-[11px] font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
        aria-label={`Administrative role for ${person.display_name}`}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ADMIN_ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      {already ? (
        <ActionButton tone="danger" onClick={() => onRevoke(selected)}>
          <X size={12} /> Revoke
        </ActionButton>
      ) : (
        <ActionButton onClick={() => onGrant(selected)}>
          <Check size={12} /> Grant
        </ActionButton>
      )}
    </div>
  );
}

/**
 * Small wrapper so a missing profile row fails with a readable message rather
 * than a raw PostgREST error. The RPC itself still enforces Super Admin.
 */
async function assignRoleSafe(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  userId: string,
  role: AdminRole,
  assign: boolean,
  reason: string,
): Promise<string | null> {
  const { assignAdminRole } = await import('@/lib/admin');
  return assignAdminRole(supabase, userId, role, assign, reason);
}
