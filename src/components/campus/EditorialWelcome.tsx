'use client';

// ============================================================================
// EDITORIAL WELCOME — the homepage masthead.
// No statistics are invented here. The greeting uses the signed-in profile
// when available, and the date is filled in after hydration to avoid a
// server/client timezone mismatch.
// ============================================================================

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';

export default function EditorialWelcome() {
  const { user, isDemoUser } = useApp();
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    );
  }, []);

  const firstName = (isDemoUser ? '' : user.name || '').split(' ')[0];

  return (
    <header className="relative">
      <p className="editorial-kicker flex flex-wrap items-center gap-2 text-violet-ink dark:text-violet">
        <span className="inline-block h-px w-6 bg-current" />
        Northern University Bangladesh
        <span className="opacity-40">/</span>
        Campus edition
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-[40px]">
            {firstName ? (
              <>
                Welcome back, <span className="font-editorial font-normal italic text-coral-ink dark:text-editorial-coral">{firstName}.</span>
              </>
            ) : (
              <>
                Your campus, <span className="font-editorial font-normal italic text-coral-ink dark:text-editorial-coral">in one place.</span>
              </>
            )}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-campus-text-sec dark:text-campus-dark-sec">
            Meet people. Find your circle. Live your campus — together.
          </p>
          <p lang="bn" className="bengali mt-1 text-sm font-medium text-campus-text-sec dark:text-campus-dark-sec">
            তোমার ক্যাম্পাস, তোমার মানুষ।
          </p>
        </div>
        {today && (
          <p className="editorial-kicker shrink-0 text-campus-text-sec dark:text-campus-dark-sec">{today}</p>
        )}
      </div>
      <div className="editorial-rule mt-5 text-campus-text dark:text-campus-dark-text" />
    </header>
  );
}
