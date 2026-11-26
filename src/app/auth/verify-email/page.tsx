'use client';

// ============================================================================
// Email verification landing + resend. Reached after the callback establishes
// a session, so a signed-in visitor sees an honest "verified" state.
// ============================================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import AuthShell, {
  AuthError,
  ConfigRequired,
  authButtonCls,
  authInputCls,
  authLabelCls,
  authSecondaryButtonCls,
} from '@/components/auth/AuthShell';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { friendlyAuthError, validateEmail } from '@/lib/auth';

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setVerified(Boolean(data.session));
      setEmail(data.session?.user.email ?? '');
      setChecked(true);
    });
  }, []);

  if (!isBackendConfigured()) {
    return (
      <AuthShell title="Verify your email" subtitle="Email verification is part of connected accounts.">
        <ConfigRequired feature="Email verification" />
      </AuthShell>
    );
  }

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');

    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/verify-email')}`,
      },
    });
    setBusy(false);
    if (resendError) return setError(friendlyAuthError(resendError.message));
    setError(null);
    setChecked(false);
    setTimeout(() => setChecked(true), 10);
  };

  if (verified) {
    return (
      <AuthShell title="Email verified" subtitle="Your account is active and your session is secure on this device.">
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl bg-lime-soft p-3 text-xs font-semibold leading-relaxed text-lime-ink ring-1 ring-lime/30 dark:bg-lime/10 dark:text-lime">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              You’re signed in. Your account is separate from NUB Verified status — request that
              review from your profile settings whenever you’re ready.
            </span>
          </div>
          <Link href="/home" className={authButtonCls}>
            Go to campus <ArrowRight size={15} />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Open the link we emailed you to activate your account."
      footer={
        <Link href="/auth/login" className="font-bold text-violet-ink hover:underline dark:text-violet">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={resend} className="space-y-4">
        {error && <AuthError>{error}</AuthError>}
        <div className="flex items-start gap-2 rounded-xl bg-campus-bg p-3 text-xs leading-relaxed ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border">
          <MailCheck size={16} className="mt-0.5 shrink-0 text-violet-ink dark:text-violet" />
          <span>
            Didn’t get it? Check spam, or resend to the address you registered with. We never reveal
            whether an address already has an account.
          </span>
        </div>
        <div>
          <label htmlFor="verify-email" className={authLabelCls}>
            Email
          </label>
          <input
            id="verify-email"
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
        <button type="submit" disabled={busy || !checked} className={authSecondaryButtonCls}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <MailCheck size={15} />}
          {busy ? 'Sending…' : 'Resend verification email'}
        </button>
      </form>
    </AuthShell>
  );
}
