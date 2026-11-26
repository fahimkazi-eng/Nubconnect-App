'use client';

// ============================================================================
// NUBCONNECT — shared auth chrome.
// One calm, mobile-first frame for every account screen. When no backend is
// configured we show an honest configuration panel instead of a fake form.
// ============================================================================
import Link from 'next/link';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';

export const authInputCls =
  'touch-target w-full rounded-xl border border-campus-border bg-campus-card px-3 py-2.5 text-sm outline-none transition focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text';

export const authLabelCls =
  'mb-1 block text-xs font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec';

export const authButtonCls =
  'touch-target flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-bold text-plum shadow-violet-glow transition hover:brightness-105 disabled:opacity-50';

export const authSecondaryButtonCls =
  'touch-target flex w-full items-center justify-center gap-2 rounded-xl bg-campus-bg px-4 py-2.5 text-sm font-bold ring-1 ring-campus-border transition hover:bg-violet-soft disabled:opacity-50 dark:bg-campus-dark-elev dark:ring-campus-dark-border dark:hover:bg-violet-dark-soft';

function Wordmark() {
  return (
    <span className="font-display text-lg font-extrabold tracking-tight">
      NUB<span className="text-violet-ink dark:text-violet">CONNECT</span>
    </span>
  );
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-campus-bg px-4 py-10 dark:bg-campus-dark-bg">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-aqua/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/home" className="mb-5 flex items-center justify-center" aria-label="NUBCONNECT home">
          <Wordmark />
        </Link>

        <div className="card p-6 sm:p-7">
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
              {subtitle}
            </p>
          )}
          <div className="mt-5">{children}</div>
        </div>

        {footer && <div className="mt-4 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">{footer}</div>}

        <p className="mt-5 flex items-start justify-center gap-1.5 px-2 text-center text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-lime-ink dark:text-lime" />
          <span>
            A NUBCONNECT account is not NUB Verified status. Verification is a separate review by
            Northern University Bangladesh staff.
          </span>
        </p>
      </div>
    </main>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-coral-soft px-3 py-2.5 text-xs font-semibold leading-relaxed text-coral-ink ring-1 ring-coral/30 dark:bg-coral/10 dark:text-coral"
    >
      {children}
    </p>
  );
}

export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-lime-soft px-3 py-2.5 text-xs font-semibold leading-relaxed text-lime-ink ring-1 ring-lime/30 dark:bg-lime/10 dark:text-lime">
      {children}
    </div>
  );
}

/**
 * Shown whenever accounts are not wired to a real backend. We deliberately do
 * not render a form that cannot work.
 */
export function ConfigRequired({ feature = 'Student accounts' }: { feature?: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-sunshine-soft p-3.5 text-amber-800 ring-1 ring-amber-300/60 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/30">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <KeyRound size={15} /> {feature} aren’t connected yet
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed">
          This deployment has no Supabase project configured, so there is no real sign-in to offer.
          NUBCONNECT never shows a fake login form.
        </p>
      </div>

      <div className="rounded-xl bg-campus-bg p-3 font-mono text-[11px] leading-relaxed ring-1 ring-campus-border dark:bg-campus-dark-elev dark:ring-campus-dark-border">
        <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
          Required environment
        </p>
        NEXT_PUBLIC_SUPABASE_URL
        <br />
        NEXT_PUBLIC_SUPABASE_ANON_KEY
      </div>

      <p className="text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        Add those values to the deployment, apply the SQL in{' '}
        <code className="font-mono">supabase/migrations</code>, then reload. Until then the campus
        stays in clearly-labelled demo mode.
      </p>

      <Link href="/home" className={authButtonCls}>
        Continue in demo mode <ArrowRight size={15} />
      </Link>
    </div>
  );
}
