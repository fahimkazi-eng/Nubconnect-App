'use client';

// ============================================================================
// Forgot password — sends a real Supabase recovery link. The response is
// intentionally generic so the form cannot be used to enumerate accounts.
// ============================================================================
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import AuthShell, {
  AuthError,
  AuthNotice,
  ConfigRequired,
  authButtonCls,
  authInputCls,
  authLabelCls,
} from '@/components/auth/AuthShell';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { friendlyAuthError, validateEmail } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isBackendConfigured()) {
    return (
      <AuthShell title="Reset your password" subtitle="Password recovery needs a connected backend.">
        <ConfigRequired feature="Password recovery" />
      </AuthShell>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');

    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`,
    });
    setBusy(false);
    if (resetError) return setError(friendlyAuthError(resetError.message));
    setSent(true);
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email you a secure link to choose a new password."
      footer={
        <Link href="/auth/login" className="font-bold text-violet-ink hover:underline dark:text-violet">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <AuthNotice>
            <span className="flex items-start gap-1.5">
              <MailCheck size={14} className="mt-0.5 shrink-0" />
              If an account exists for <strong>{email}</strong>, a reset link is on its way. The link
              expires shortly for your safety.
            </span>
          </AuthNotice>
          <p className="text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Nothing arrived? Check spam, then try again in a minute. We don’t reveal whether an
            address is registered.
          </p>
          <Link href="/auth/login" className={authButtonCls}>
            Return to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <AuthError>{error}</AuthError>}
          <div>
            <label htmlFor="forgot-email" className={authLabelCls}>
              Email
            </label>
            <input
              id="forgot-email"
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
          <button type="submit" disabled={busy} className={authButtonCls}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <MailCheck size={15} />}
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
