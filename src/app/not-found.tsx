import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-campus-bg px-6 text-center dark:bg-campus-dark-bg">
      <Compass size={36} className="text-violet-ink dark:text-violet" aria-hidden="true" />
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-violet-ink dark:text-violet">404</p>
      <h1 className="font-display text-2xl font-extrabold">This page wandered off campus</h1>
      <p className="max-w-sm text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
        The link may be old, mistyped or removed. Everything that exists on NUBCONNECT is reachable from the feed.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/home" className="touch-target btn-press rounded-2xl bg-violet px-5 py-3 text-sm font-bold text-plum shadow-violet-glow">
          Back to the feed
        </Link>
        <Link href="/more" className="rounded-2xl bg-campus-card px-5 py-3 text-sm font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
          Browse everything
        </Link>
      </div>
    </main>
  );
}
