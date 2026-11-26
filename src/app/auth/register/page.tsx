'use client';

// ============================================================================
// Create account — real Supabase sign-up with email verification.
// The database trigger creates the profile; verification status starts FALSE.
// ============================================================================
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, MailCheck, UserPlus } from 'lucide-react';
import AuthShell, {
  AuthError,
  AuthNotice,
  ConfigRequired,
  authButtonCls,
  authInputCls,
  authLabelCls,
  authSecondaryButtonCls,
} from '@/components/auth/AuthShell';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import {
  friendlyAuthError,
  normalizeUsername,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isBackendConfigured()) {
    return (
      <AuthShell title="Create an account" subtitle="Accounts are part of the connected-campus experience.">
        <ConfigRequired feature="Student accounts" />
      </AuthShell>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const checks = [
      validateDisplayName(displayName),
      validateUsername(username),
      validateEmail(email),
      validatePassword(password),
    ];
    const firstError = checks.find(Boolean);
    if (firstError) return setError(firstError);
    if (password !== confirm) return setError('Passwords do not match.');
    if (!consent) return setError('Please confirm the community rules to continue.');

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');

    setBusy(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          username: normalizeUsername(username),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/verify-email')}`,
      },
    });
    setBusy(false);

    if (authError) return setError(friendlyAuthError(authError.message));

    // Email confirmation disabled → the session is already live.
    if (data.session) {
      router.replace('/home');
      router.refresh();
      return;
    }

    setSent(true);
  };

  const resend = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/verify-email')}`,
      },
    });
    setBusy(false);
    if (resendError) setError(friendlyAuthError(resendError.message));
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="One more step before your account is active."
        footer={
          <Link href="/auth/login" className="font-bold text-violet-ink hover:underline dark:text-violet">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl bg-lime-soft p-3 text-xs font-semibold leading-relaxed text-lime-ink ring-1 ring-lime/30 dark:bg-lime/10 dark:text-lime">
            <MailCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              We sent a verification link to <strong>{email}</strong>. Open it to finish creating
              your account.
            </span>
          </div>
          {error && <AuthError>{error}</AuthError>}
          <p className="text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            If an account already exists for this email, sign in instead — we never reveal whether
            an address is registered.
          </p>
          <button type="button" onClick={resend} disabled={busy} className={authSecondaryButtonCls}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <MailCheck size={15} />}
            Resend verification email
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join the student campus. Your profile starts private to your university."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/auth/login" className="font-bold text-violet-ink hover:underline dark:text-violet">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <AuthError>{error}</AuthError>}

        <div>
          <label htmlFor="reg-name" className={authLabelCls}>
            Full name
          </label>
          <input
            id="reg-name"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Tasnim Rahman"
            className={authInputCls}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-username" className={authLabelCls}>
            Username
          </label>
          <input
            id="reg-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. tasnim.cse"
            className={authInputCls}
            required
          />
          <p className="mt-1 text-[11px] text-campus-text-sec dark:text-campus-dark-sec">
            Lowercase letters, numbers, dots, underscores or hyphens. If it’s taken, a short unique
            suffix is added.
          </p>
        </div>

        <div>
          <label htmlFor="reg-email" className={authLabelCls}>
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={authInputCls}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-password" className={authLabelCls}>
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={authInputCls}
            required
          />
        </div>

        <div>
          <label htmlFor="reg-confirm" className={authLabelCls}>
            Confirm password
          </label>
          <input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className={authInputCls}
            required
          />
        </div>

        <label className="flex items-start gap-2 rounded-xl bg-campus-bg p-3 text-[11px] leading-relaxed ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-violet"
          />
          <span>
            I agree to the community rules: be respectful, share only my own photos, and never post
            someone else’s private information.
          </span>
        </label>

        <AuthNotice>
          <span className="flex items-start gap-1.5">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            Creating an account does not grant NUB Verified status. You can request that review
            separately from your profile settings.
          </span>
        </AuthNotice>

        <button type="submit" disabled={busy} className={authButtonCls}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
