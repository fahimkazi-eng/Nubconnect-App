'use client';

// ============================================================================
// Sign in — animated campus login.
// The visual layer uses the reusable modern-animated-sign-in primitives; the
// behaviour stays the real Supabase email/password flow with Google offered
// only when the deployment enables it. No backend → honest config panel.
// ============================================================================
import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  AnimatedForm,
  Ripple,
  TechOrbitDisplay,
  type IconConfig,
} from '@/components/ui/modern-animated-sign-in';
import { ConfigRequired } from '@/components/auth/AuthShell';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { friendlyAuthError, isGoogleAuthEnabled, validateEmail } from '@/lib/auth';
import { nubPhotoById } from '@/lib/nubAssets';

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/home';
  return raw;
}

/**
 * Campus-themed orbiting icons. Lucide keeps the animation dependency-free —
 * no remote image host has to be allow-listed for the login screen to render.
 */
const orbitIcons: IconConfig[] = [
  {
    component: () => <GraduationCap className='size-6 text-violet-ink dark:text-violet' />,
    className: 'size-12 border-none bg-transparent',
    duration: 22,
    delay: 0,
    radius: 95,
    path: false,
  },
  {
    component: () => <Users className='size-6 text-coral-ink dark:text-coral' />,
    className: 'size-12 border-none bg-transparent',
    duration: 26,
    delay: 8,
    radius: 95,
    path: false,
  },
  {
    component: () => <BookOpen className='size-6 text-aqua-ink dark:text-aqua' />,
    className: 'size-12 border-none bg-transparent',
    duration: 24,
    delay: 4,
    radius: 165,
    path: false,
  },
  {
    component: () => <CalendarDays className='size-6 text-violet-ink dark:text-violet' />,
    className: 'size-12 border-none bg-transparent',
    duration: 28,
    delay: 14,
    radius: 165,
    path: false,
    reverse: true,
  },
  {
    component: () => <MessageCircle className='size-6 text-lime-ink dark:text-lime' />,
    className: 'size-12 border-none bg-transparent',
    duration: 30,
    delay: 6,
    radius: 235,
    path: false,
    reverse: true,
  },
  {
    component: () => <Sparkles className='size-6 text-coral-ink dark:text-coral' />,
    className: 'size-12 border-none bg-transparent',
    duration: 34,
    delay: 18,
    radius: 235,
    path: false,
  },
];

/** Authentic NUB Permanent Campus photograph from the bundled nub.ac.bd registry. */
const campusPhoto = nubPhotoById('nub-campus-1') ?? {
  file: '/assets/nub/campus-permanent-1.jpg',
  album: 'Permanent Campus',
  origin: 'nub.ac.bd' as const,
  sourceUrl: 'https://nub.ac.bd/gallery/picture/jekvqt4w/permanent-campus',
};

function Wordmark() {
  return (
    <Link href="/" className="font-display text-lg font-extrabold tracking-tight" aria-label="NUBCONNECT home">
      NUB<span className="text-violet-ink dark:text-violet">CONNECT</span>
    </Link>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const callbackError = params.get('error');
  const googleEnabled = isGoogleAuthEnabled();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    callbackError ? friendlyAuthError(callbackError) : null,
  );
  const [busy, setBusy] = useState(false);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);
    if (!password) return setError('Enter your password.');

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (authError) return setError(friendlyAuthError(authError.message));
    router.replace(next);
    router.refresh();
  };

  const signInWithGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Accounts are not configured on this deployment.');
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (authError) {
      setBusy(false);
      setError(friendlyAuthError(authError.message));
    }
  };

  const goToForgotPassword = () => router.push('/auth/forgot-password');

  return (
    <AnimatedForm
      header="Welcome back"
      subHeader="Sign in to your student account. Your session stays on this device."
      fields={[
        {
          label: 'Email',
          required: true,
          type: 'email',
          name: 'email',
          autoComplete: 'email',
          inputMode: 'email',
          placeholder: 'you@example.com',
          onChange: (event) => setEmail(event.target.value),
        },
        {
          label: 'Password',
          required: true,
          type: 'password',
          name: 'password',
          autoComplete: 'current-password',
          placeholder: '••••••••',
          onChange: (event) => setPassword(event.target.value),
        },
      ]}
      submitButton={busy ? 'Signing in…' : 'Sign in'}
      textVariantButton="Forgot password?"
      goTo={goToForgotPassword}
      errorField={error ?? undefined}
      googleLogin={googleEnabled ? 'Continue with Google' : undefined}
      onGoogleLogin={googleEnabled ? signInWithGoogle : undefined}
      busy={busy}
      onSubmit={signIn}
    />
  );
}

function LoginVisual() {
  return (
    <aside className="dark relative hidden w-1/2 flex-col justify-center overflow-hidden border-r border-campus-dark-border bg-campus-dark-bg lg:flex">
      {/* Authentic NUB Permanent Campus photo (nub.ac.bd), dimmed for text legibility. */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src={campusPhoto.file}
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-plum/80 via-plum/70 to-plum/90" />
      </div>

      <div aria-hidden className="absolute inset-0">
        <Ripple mainCircleSize={100} />
      </div>
      <div aria-hidden className="relative z-10 flex h-full items-center justify-center px-8">
        <TechOrbitDisplay iconsArray={orbitIcons} text="NUBCONNECT" />
      </div>

      <div className="absolute inset-x-0 bottom-10 z-10 px-12 text-center">
        <p className="font-display text-xl font-extrabold tracking-tight text-white">
          Meet people. Find your circle.
        </p>
        <p className="mt-1 text-sm font-semibold text-white/80">
          Live your campus — together.
        </p>
        <a
          href={campusPhoto.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-[11px] font-semibold text-white/60 underline decoration-white/30 underline-offset-2 transition hover:text-white"
        >
          {campusPhoto.album} · {campusPhoto.origin}
        </a>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  const configured = isBackendConfigured();

  return (
    <main className="flex min-h-dvh w-full bg-campus-bg text-campus-text dark:bg-campus-dark-bg dark:text-campus-dark-text">
      <LoginVisual />

      <section className="relative flex w-full flex-col items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="mb-4 flex w-full max-w-md items-center justify-between lg:hidden">
          <Wordmark />
        </div>

        {/* Mobile gets a real campus visual too — the photo and its source are
            never hidden entirely on small screens. */}
        <div className="relative mb-6 h-36 w-full max-w-md overflow-hidden rounded-2xl lg:hidden">
          <Image
            src={campusPhoto.file}
            alt="Permanent campus of Northern University Bangladesh"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-plum/85 via-plum/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="font-display text-sm font-extrabold text-white">
              Meet people. Find your circle.
            </p>
            <a
              href={campusPhoto.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-[10px] font-semibold text-white/70 underline decoration-white/30 underline-offset-2"
            >
              {campusPhoto.album} · {campusPhoto.origin}
            </a>
          </div>
        </div>

        <div className="w-full max-w-md">
          {configured ? (
            <Suspense
              fallback={
                <p className="text-center text-sm text-campus-text-sec dark:text-campus-dark-sec">
                  Loading sign-in…
                </p>
              }
            >
              <LoginForm />
            </Suspense>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-campus-text dark:text-campus-dark-text">
                  Sign in
                </h1>
                <p className="mt-1.5 text-sm text-campus-text-sec dark:text-campus-dark-sec">
                  Accounts are part of the connected-campus experience.
                </p>
              </div>
              <ConfigRequired feature="Student accounts" />
            </div>
          )}

          {configured && (
            <p className="mt-6 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              New here?{' '}
              <Link
                href="/auth/register"
                className="font-bold text-violet-ink hover:underline dark:text-violet"
              >
                Create an account
              </Link>
            </p>
          )}

          <p className="mt-5 flex items-start justify-center gap-1.5 px-2 text-center text-[11px] leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-lime-ink dark:text-lime" />
            <span>
              A NUBCONNECT account is not NUB Verified status. Verification is a separate review by
              Northern University Bangladesh staff.
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}
