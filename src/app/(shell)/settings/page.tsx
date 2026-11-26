'use client';

// Settings — appearance, privacy controls, and the notification preferences
// this schema actually stores. Signed-in choices are written to the student's
// own user_preferences row (RLS); nothing pretends to save without an account.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Eye,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  Pencil,
  Sun,
  UserRound,
} from 'lucide-react';
import { useApp, type PrivacyPrefs } from '@/lib/store';
import { isNotificationPreferenceAvailable, type NotificationPreferenceKey } from '@/lib/notifications';
import { pinDef } from '@/lib/nav';
import { Avatar, DemoTag } from '@/components/ui/kit';

const DISCOVERABILITY = ['University Students Only', 'Verified Students Only', 'Public'] as const;
const MESSAGING = ['Anyone', 'University Students Only', 'Consent Requests Only'] as const;

/** Only preferences with a real user_preferences column are rendered. */
const NOTIFICATION_ROWS: {
  key: NotificationPreferenceKey;
  label: string;
  hint: string;
}[] = [
  {
    key: 'notifyEvents',
    label: 'Events & campus updates',
    hint: 'Stored on your account. Delivery filtering requires backend support.',
  },
  {
    key: 'notifyClubUpdates',
    label: 'Club & circle updates',
    hint: 'Stored on your account. Delivery filtering requires backend support.',
  },
  {
    key: 'notifyRoommateInquiries',
    label: 'Roommate enquiries',
    hint: 'Stored on your account. Delivery filtering requires backend support.',
  },
];

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-campus-text-sec dark:text-campus-dark-sec">{hint}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">{children}</div>
    </div>
  );
}

const selectCls =
  'touch-target w-[190px] rounded-xl border border-campus-border bg-campus-card px-3 py-2 text-xs font-bold outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';

const chipCls = 'rounded-full px-2.5 py-1 text-[10px] font-bold';

function Toggle({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`touch-target relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'bg-violet' : 'bg-campus-border dark:bg-campus-dark-border'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
        aria-hidden
      />
    </button>
  );
}

/** Honest, real save/load status for the signed-in student's preferences. */
function SaveStatus({
  signedIn,
  loading,
  saving,
  error,
  onRetry,
}: {
  signedIn: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!signedIn) {
    return <span className={`${chipCls} bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec`}>Sign in to save</span>;
  }
  if (loading) {
    return <span className={`${chipCls} bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet`}>Loading…</span>;
  }
  if (error) {
    return (
      <span className="flex items-center gap-1.5">
        <span className={`${chipCls} bg-coral-soft text-coral-ink dark:bg-coral/15 dark:text-coral`}>Not saved</span>
        <button
          type="button"
          onClick={onRetry}
          className="touch-target rounded-lg px-2 text-[10px] font-bold text-violet-ink underline dark:text-violet"
        >
          Retry
        </button>
      </span>
    );
  }
  if (saving) {
    return <span className={`${chipCls} bg-violet-soft text-violet-ink dark:bg-violet-dark-soft dark:text-violet`}>Saving…</span>;
  }
  return <span className={`${chipCls} bg-lime-soft text-lime-ink dark:bg-lime/10 dark:text-lime`}>Saved to your account</span>;
}

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    privacy,
    setPrivacy,
    preferencesLoading,
    preferencesSaving,
    preferencesError,
    retrySavePreferences,
    theme,
    toggleTheme,
    pins,
    isDemoUser,
    authConfigured,
    signOut,
    presenceHidden,
    setPresenceHidden,
  } = useApp();

  const toggle = (key: NotificationPreferenceKey, value: boolean) => {
    // All three keys are real columns; keep the write shaped by PrivacyPrefs.
    void setPrivacy({ [key]: value } as Partial<PrivacyPrefs>);
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-extrabold sm:text-2xl">Settings</h1>
        <p className="text-sm text-campus-text-sec dark:text-campus-dark-sec">
          {!isDemoUser
            ? 'Privacy and notification choices are saved to your student account.'
            : authConfigured
              ? 'Sign in to save preferences to your student account.'
              : 'Demo browser — choices stay on this device and are not saved to an account.'}
        </p>
      </header>

      {/* Account */}
      <Section icon={<UserRound size={15} className="text-violet-ink" />} title="Account">
        <div className="flex items-center gap-3">
          <Avatar seed={user.id} name={user.name} size={48} src={user.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {user.name} {isDemoUser && <DemoTag compact />}
            </p>
            <p className="text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
              @{user.username} • {user.departmentCode} {user.semester}
            </p>
            {user.email && (
              <p className="truncate text-[11px] text-campus-text-sec dark:text-campus-dark-sec">{user.email}</p>
            )}
          </div>
          <Link href={`/profile/${user.username}`} className="shrink-0 text-xs font-bold text-violet-ink hover:underline">
            View
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-campus-border pt-3 dark:border-campus-dark-border">
          <Link
            href="/settings/profile"
            className="touch-target inline-flex items-center gap-1.5 rounded-xl bg-violet px-3.5 py-2 text-[11px] font-bold text-plum shadow-violet-glow"
          >
            <Pencil size={13} /> Edit profile & photos
          </Link>
          {!isDemoUser && (
            <button
              onClick={async () => {
                await signOut();
                router.replace('/auth/login');
                router.refresh();
              }}
              className="touch-target inline-flex items-center gap-1.5 rounded-xl bg-campus-bg px-3.5 py-2 text-[11px] font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
            >
              <LogOut size={13} /> Sign out
            </button>
          )}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          {isDemoUser
            ? 'Demo identity — the name, photo and verified badge are clearly-labelled sample data, not a real student.'
            : user.isVerified
              ? 'This account is NUB Verified — reviewed by university staff.'
              : 'This is a student account, not NUB Verified status. Verification is a separate review you can request from Edit profile.'}
        </p>
      </Section>

      {/* Appearance */}
      <Section icon={theme === 'dark' ? <Moon size={15} className="text-violet-ink" /> : <Sun size={15} className="text-violet-ink" />} title="Appearance">
        <Row label="Theme" hint="Dark mode is intentional and tuned for campus nights.">
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="touch-target flex items-center gap-1.5 rounded-xl bg-campus-bg px-3.5 py-2 text-xs font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </Row>
      </Section>

      {/* Privacy */}
      <Section icon={<Eye size={15} className="text-violet-ink" />} title="Privacy">
        <Row label="Who can find you" hint="Discoverability in People You May Know and search.">
          <select
            value={privacy.discoverability}
            onChange={(e) => void setPrivacy({ discoverability: e.target.value as (typeof DISCOVERABILITY)[number] })}
            aria-label="Discoverability"
            className={selectCls}
          >
            {DISCOVERABILITY.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Row>
        <Row label="Who can message you" hint="Consent requests never reveal your phone number.">
          <select
            value={privacy.allowMessages}
            onChange={(e) => void setPrivacy({ allowMessages: e.target.value as (typeof MESSAGING)[number] })}
            aria-label="Messaging permission"
            className={selectCls}
          >
            {MESSAGING.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Row>
        <Row
          label="Appear offline (this device)"
          hint="Device-local only — other devices still show you as active. Syncs across devices only after migration 018 is applied."
        >
          <Toggle
            on={presenceHidden}
            onChange={(v) => setPresenceHidden(v)}
            label="Appear offline on this device"
          />
        </Row>
        <Row label="Show semester on profile" hint="Some students prefer department only.">
          <Toggle on={privacy.showSemester} onChange={(v) => void setPrivacy({ showSemester: v })} label="Show semester" />
        </Row>
        <Row label="Appear in Campus Honours" hint="Opt out to keep your contributions private — hides you from recognition instantly.">
          <Toggle on={privacy.showInHonours} onChange={(v) => void setPrivacy({ showInHonours: v })} label="Appear in Campus Honours" />
        </Row>
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-campus-border pt-2 dark:border-campus-dark-border">
          <span className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">Preference status</span>
          <SaveStatus
            signedIn={!isDemoUser}
            loading={preferencesLoading}
            saving={preferencesSaving}
            error={preferencesError}
            onRetry={() => void retrySavePreferences()}
          />
        </div>
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-lime-soft p-2.5 text-[11px] leading-relaxed text-lime-ink dark:bg-lime/10 dark:text-lime">
          <Lock size={12} className="mt-0.5 shrink-0" />
          NUBCONNECT is photo-only and never publishes your address or phone number. Roommate enquiries and marketplace chats always
          stay in private conversations.
        </p>
      </Section>

      {/* Notifications */}
      <Section icon={<Bell size={15} className="text-violet-ink" />} title="Notifications">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">Saved notification choices</span>
          <SaveStatus
            signedIn={!isDemoUser}
            loading={preferencesLoading}
            saving={preferencesSaving}
            error={preferencesError}
            onRetry={() => void retrySavePreferences()}
          />
        </div>

        {NOTIFICATION_ROWS.filter((row) => isNotificationPreferenceAvailable(row.key)).map((row) => (
          <Row key={row.key} label={row.label} hint={row.hint}>
            <Toggle
              on={privacy[row.key]}
              onChange={(value) => toggle(row.key, value)}
              label={row.label}
              disabled={isDemoUser || preferencesLoading}
            />
          </Row>
        ))}

        <Row
          label="Message request notifications"
          hint="No per-category setting is stored for message requests. Requests always appear in Chats."
        >
          <Toggle on={false} onChange={() => {}} label="Message request notifications" disabled />
          <span className={`${chipCls} bg-campus-bg text-campus-text-sec dark:bg-campus-dark-elev dark:text-campus-dark-sec`}>
            Requires backend support
          </span>
        </Row>

        {preferencesError && !isDemoUser && (
          <p className="mt-1 text-[11px] font-semibold text-coral-ink dark:text-coral" role="alert">
            {preferencesError} — use Retry to save your latest choices.
          </p>
        )}
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-sunshine-soft p-2.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
          <Bell size={12} className="mt-0.5 shrink-0" />
          These three switches are saved in your account, but the server does not yet read them when creating notifications. Today
          NUBCONNECT writes notifications for new posts, comments and reactions; event, club and roommate delivery filters require
          backend support. See your actual notifications any time in Notifications.
        </p>
      </Section>

      {/* My Pins */}
      <Section icon={<MessageCircle size={15} className="text-violet-ink" />} title="My Pins">
        <p className="mb-2 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          Your pinned destinations appear first in the sidebar and on the More page. Pinning never removes a primary
          destination.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {pins.map((key) => (
            <span
              key={key}
              className="rounded-full bg-campus-bg px-3 py-1.5 text-[11px] font-bold ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border"
            >
              {pinDef(key).label}
            </span>
          ))}
        </div>
        <Link
          href="/more#pins"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet px-3.5 py-2 text-[11px] font-bold text-plum shadow-violet-glow"
        >
          Edit pins in More →
        </Link>
      </Section>

      {/* About */}
      <Section icon={<UserRound size={15} className="text-violet-ink" />} title="About this build">
        <div className="space-y-1.5 text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          <p>
            NUBCONNECT runs in demo mode until Supabase credentials are configured — all campus content is labelled{' '}
            <DemoTag compact /> and never represents real students.
          </p>
          <p>Photos only: this release has no video support anywhere, by design.</p>
          <p>Follow, Join and Message are intentionally separate — there are no friend requests.</p>
        </div>
      </Section>
    </div>
  );
}
