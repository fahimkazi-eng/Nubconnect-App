'use client';

// ============================================================================
// Choose a new password. Requires the recovery session established by
// /auth/callback; otherwise shows an honest expired-link state.
// ============================================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import AuthShell, {
  AuthError,
  ConfigRequired,
  authButtonCls,
  authInputCls,
  authLabelCls,
} from '@/components/auth/AuthShell';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { friendlyAuthError, validatePassword } from '@/lib/auth';

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setReady(true);
    });
  }, []);

  if (!isBackendConfigured()) {
    return (
      <AuthShell title="Choose a new password" subtitle="Password recovery needs a connected backend.">
        <ConfigRequired feature="Password recovery" />
      </AuthShell>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    if (password !== confirm) return setError('Passwords do not match.');

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(friendlyAuthError(updateError.message));
    setDone(true);
  };

  if (!ready) {
    return (
      <AuthShell title="Choose a new password" subtitle="Checking your recovery link…">
        <p className="flex items-center gap-2 text-sm text-campus-text-sec dark:text-campus-dark-sec">
          <Loader2 size={15} className="animate-spin" /> One moment…
        </p>
      </AuthShell>
    );
  }

  if (!hasSession) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="Recovery links are short-lived. Request a fresh one to continue."
        footer={
          <Link href="/auth/login" className="font-bold text-violet-ink hover:underline dark:text-violet">
            Back to sign in
          </Link>
        }
      >
        <Link href="/auth/forgot-password" className={authButtonCls}>
          Request a new link <ArrowRight size={15} />
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Your new password is active on this device.">
        <Link href="/home" className={authButtonCls}>
          Go to campus <ArrowRight size={15} />
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters with a letter and a number.">
      <form onSubmit={submit} className="space-y-4">
        {error && <AuthError>{error}</AuthError>}
        <div>
          <label htmlFor="reset-password" className={authLabelCls}>
            New password
          </label>
          <input
            id="reset-password"
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
          <label htmlFor="reset-confirm" className={authLabelCls}>
            Confirm new password
          </label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className={authInputCls}
            required
          />
        </div>
        <button type="submit" disabled={busy} className={authButtonCls}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}
