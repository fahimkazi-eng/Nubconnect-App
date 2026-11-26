'use client';

// App Router error boundary. A client crash here shows a calm, honest
// explanation instead of Next's default screen — with a way back.
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side logging only; no external service is configured, so nothing
    // leaves the device unless a monitoring provider is added later.
    console.error('NUBCONNECT client error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-campus-bg px-6 text-center dark:bg-campus-dark-bg">
      <AlertTriangle size={36} className="text-coral-ink dark:text-coral" aria-hidden="true" />
      <h1 className="font-display text-2xl font-extrabold">Something went wrong</h1>
      <p className="max-w-sm text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        The page hit an unexpected problem. You can try again, or head back to the feed. Whatever you were doing
        was not saved unless the app told you it was.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={reset}
          className="touch-target btn-press rounded-2xl bg-violet px-5 py-3 text-sm font-bold text-plum shadow-violet-glow"
        >
          Try again
        </button>
        <Link href="/home" className="rounded-2xl bg-campus-card px-5 py-3 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
          Back to the feed
        </Link>
      </div>
    </main>
  );
}
